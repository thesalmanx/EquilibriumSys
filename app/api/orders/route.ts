// app/api/orders/route.ts
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = request.nextUrl;
    const status     = searchParams.get('status');
    const customerId = searchParams.get('customerId');
    const startDate  = searchParams.get('startDate');
    const endDate    = searchParams.get('endDate');
    const search     = searchParams.get('search');
    const limit      = parseInt(searchParams.get('limit')  || '100', 10);
    const offset     = parseInt(searchParams.get('offset') || '0',   10);

    // Build Prisma filters
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
        where: where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
        include: {
          customer: {
            select: { id: true, name: true, email: true },
          },
          items: {
            select: {
              id: true,
              quantity: true,
              price: true,
              product: { select: { id: true, name: true, sku: true } },
            },
          },
        },
      }),
      db.order.count({ where: where }),
    ]);

    return NextResponse.json({ orders, total, limit, offset });
  } catch (err) {
    console.error('GET /api/orders error', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only ADMIN or STAFF
    if (!['ADMIN', 'STAFF'].includes(session.user.role!)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

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

    // Validate items, calculate subtotal, prepare inventory updates
    let subtotal = 0;
    const itemsToCreate: any[] = [];
    const inventoryUpdates: { id: string; quantity: number }[] = [];
    const historyEntries: any[] = [];

    for (const itm of data.items) {
      if (!itm.productId || itm.quantity <= 0) {
        return NextResponse.json(
          { error: 'Each item must have a productId and positive quantity' },
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
          { error: `Not enough stock for ${product.name}. Have ${product.quantity}` },
          { status: 400 }
        );
      }

      const price = itm.price ?? product.price;
      subtotal += price * itm.quantity;

      itemsToCreate.push({ productId: itm.productId, quantity: itm.quantity, price });
      inventoryUpdates.push({
        id: product.id,
        quantity: product.quantity - itm.quantity,
      });
      historyEntries.push({
        itemId:    product.id,
        action:    'REMOVE',
        quantity:  itm.quantity,
        notes:     'Removed for order',
        userId:    session.user.id,
      });
    }

    const discount = data.discount || 0;
    const total    = Math.max(0, subtotal - discount);
    const count    = await db.order.count();
    const orderNum = `ORD-${String(count + 1).padStart(5, '0')}`;

    // Transaction: create order, update inventory, history, status log
    const newOrder = await db.$transaction(async (tx) => {
      const ord = await tx.order.create({
        data: {
          orderNumber: orderNum,
          customerId:  data.customerId,
          subtotal,
          discount,
          tax:     data.tax   || 0,
          total,
          status:  'PENDING',
          notes:   data.notes || '',
          createdBy: { connect: { id: session.user.id } },
          payment: {
            create: {
              method: data.paymentMethod || 'CREDIT_CARD',
              status: 'PENDING',
              amount: total,
            },
          },
          items: { create: itemsToCreate },
        },
        include: {
          customer: true,
          items: { include: { product: true } },
          payment: true,
        },
      });

      for (const upd of inventoryUpdates) {
        await tx.inventoryItem.update({
          where: { id: upd.id },
          data: { quantity: upd.quantity },
        });
      }

      for (const h of historyEntries) {
        await tx.inventoryHistory.create({ data: h });
      }

      await tx.orderStatusLog.create({
        data: {
          orderId: ord.id,
          status:  'PENDING',
          notes:   'Order created',
          userId:  session.user.id,
        },
      });

      return ord;
    });

    // Low stock notifications
    for (const upd of inventoryUpdates) {
      const item = await db.inventoryItem.findUnique({ where: { id: upd.id } });
      if (item && item.quantity <= item.reorderLevel) {
        await db.notification.create({
          data: {
            type:    'LOW_STOCK',
            title:   `Low Stock: ${item.name}`,
            message: `${item.name} (${item.sku}) below reorder level`,
            userId:  session.user.id,
            metadata: {
              itemId: upd.id,
              sku:    item.sku,
              qty:    item.quantity,
              reorderLevel: item.reorderLevel,
            },
          },
        });
      }
    }

    return NextResponse.json(newOrder);
  } catch (err) {
    console.error('POST /api/orders error', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
