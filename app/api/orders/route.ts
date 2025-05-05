// app/api/orders/route.ts
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { db }                      from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const params     = request.nextUrl.searchParams;
    const status     = params.get('status');
    const customerId = params.get('customerId');
    const startDate  = params.get('startDate');
    const endDate    = params.get('endDate');
    const search     = params.get('search');
    const limit      = parseInt(params.get('limit')  || '100', 10);
    const offset     = parseInt(params.get('offset') || '0',   10);

    const where: any = {};
    if (status)     where.status     = status;
    if (customerId) where.customerId = customerId;
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) {
        const d = new Date(endDate);
        d.setDate(d.getDate() + 1);
        where.createdAt.lt = d;
      }
    }
    if (search) {
      where.OR = [
        { orderNumber: { contains: search, mode: 'insensitive' } },
        { customer:    { name:        { contains: search, mode: 'insensitive' } } },
        { customer:    { email:       { contains: search, mode: 'insensitive' } } },
      ];
    }

    const [orders, total] = await Promise.all([
      db.order.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take:    limit,
        skip:    offset,
        include: {
          customer: { select: { id: true, name: true, email: true } },
          items: {
            select: {
              id:       true,
              quantity: true,
              price:    true,
              product:  { select: { id: true, name: true, sku: true } },
            },
          },
        },
      }),
      db.order.count({ where }),
    ]);

    return NextResponse.json({ orders, total, limit, offset });
  } catch (error) {
    console.error('GET /api/orders error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    // ─── fetch a real ADMIN user ───────────────────────────────────────────────
    const admin = await db.user.findFirst({ where: { role: 'ADMIN' } });
    if (!admin) {
      console.error('✖ No ADMIN user found in DB!');
      return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 });
    }
    const userId = admin.id;

    // ─── parse + validate body ────────────────────────────────────────────────
    const data = await request.json();
    if (!data.customerId || !Array.isArray(data.items) || data.items.length === 0) {
      return NextResponse.json(
        { error: 'Customer and at least one item are required' },
        { status: 400 }
      );
    }

    const customer = await db.customer.findUnique({ where: { id: data.customerId } });
    if (!customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    // ─── validate line-items & build lists ────────────────────────────────────
    let subtotal = 0;
    const itemsToCreate: { productId: string; quantity: number; price: number }[] = [];
    const inventoryUpdates: { id: string; quantity: number }[]               = [];
    const historyEntries: {
      itemId: string;
      action: string;
      quantity: number;
      notes: string;
      userId: string;
    }[] = [];

    for (const itm of data.items) {
      if (!itm.productId || itm.quantity <= 0) {
        return NextResponse.json(
          { error: 'Each item must have a valid productId and quantity > 0' },
          { status: 400 }
        );
      }
      const product = await db.inventoryItem.findUnique({ where: { id: itm.productId } });
      if (!product) {
        return NextResponse.json(
          { error: `Product ${itm.productId} not found` },
          { status: 404 }
        );
      }
      if (product.quantity < itm.quantity) {
        return NextResponse.json(
          { error: `Not enough stock for ${product.name}. Available: ${product.quantity}` },
          { status: 400 }
        );
      }

      const price = itm.price ?? product.price;
      subtotal   += price * itm.quantity;

      itemsToCreate.push({ productId: itm.productId, quantity: itm.quantity, price });
      inventoryUpdates.push({ id: product.id, quantity: product.quantity - itm.quantity });
      historyEntries.push({
        itemId:   product.id,
        action:   'REMOVE',
        quantity: itm.quantity,
        notes:    'Removed for order',
        userId,           // ← now a *real* user
      });
    }

    // ─── compute totals & order number ────────────────────────────────────────
    const discount = data.discount ?? 0;
    const total    = Math.max(0, subtotal - discount);
    const count    = await db.order.count();
    const orderNum = `ORD-${String(count + 1).padStart(5, '0')}`;

    // ─── transaction: create order + payment + items + inventory + history + status
    const newOrder = await db.$transaction(async (tx) => {
      const ord = await tx.order.create({
        data: {
          orderNumber: orderNum,
          customerId:  data.customerId,
          subtotal,
          discount,
          tax:     data.tax   ?? 0,
          total,
          status:  'PENDING',
          notes:   data.notes ?? '',
          createdBy: { connect: { id: userId } },      // ← real user
          payment: {
            create: {
              method: data.paymentMethod ?? 'CREDIT_CARD',
              status: 'PENDING',
              amount: total,
            },
          },
          items: { create: itemsToCreate },
        },
        include: {
          customer: true,
          items:    { include: { product: true } },
          payment:  true,
        },
      });

      // inventory + history
      for (const upd of inventoryUpdates) {
        await tx.inventoryItem.update({
          where: { id: upd.id },
          data:  { quantity: upd.quantity },
        });
      }
      for (const h of historyEntries) {
        await tx.inventoryHistory.create({ data: h });
      }

      // status log
      await tx.orderStatusLog.create({
        data: {
          orderId: ord.id,
          status:  'PENDING',
          notes:   'Order created',
          userId,                                // ← real user
        },
      });

      return ord;
    });

    // ─── post‐transaction low‐stock notifications ─────────────────────────────
    for (const upd of inventoryUpdates) {
      const item = await db.inventoryItem.findUnique({ where: { id: upd.id } });
      if (item && item.quantity <= item.reorderLevel) {
        await db.notification.create({
          data: {
            type:    'LOW_STOCK',
            title:   `Low Stock Alert: ${item.name}`,
            message: `${item.name} (${item.sku}) below reorder level.`,
            userId,                            // ← real user
            metadata: {
              itemId:       item.id,
              sku:          item.sku,
              quantity:     item.quantity,
              reorderLevel: item.reorderLevel,
            },
          },
        });
      }
    }

    return NextResponse.json(newOrder);
  } catch (error) {
    console.error('POST /api/orders error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
