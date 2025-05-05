// app/api/orders/route.ts
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { db }                      from '@/lib/db';

const ADMIN_USER_ID = '6c429b14-3bf3-4371-b32d-006c26897189';

export async function GET(request: NextRequest) {
  console.log('🟢 GET /api/orders');
  try {
    const params     = request.nextUrl.searchParams;
    const status     = params.get('status');
    const customerId = params.get('customerId');
    const startDate  = params.get('startDate');
    const endDate    = params.get('endDate');
    const search     = params.get('search');
    const limit      = parseInt(params.get('limit')  || '100', 10);
    const offset     = parseInt(params.get('offset') || '0',   10);

    console.log('  • query:', { status, customerId, startDate, endDate, search, limit, offset });

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

    console.log('  • prisma where:', where);

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

    console.log(`  ✅ returning ${orders.length} orders (total=${total})`);
    return NextResponse.json({ orders, total, limit, offset });
  } catch (err: any) {
    console.error('  ❌ GET error:', err);
    return NextResponse.json(
      { error: err.message, stack: err.stack },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  console.log('🔴 POST /api/orders');
  try {
    const data = await request.json();
    console.log('  • payload:', data);

    // Validate
    if (!data.customerId || !Array.isArray(data.items) || data.items.length === 0) {
      console.warn('  ⚠️ missing customerId/items');
      return NextResponse.json(
        { error: 'Customer and at least one item are required' },
        { status: 400 }
      );
    }

    // Customer exists?
    const customer = await db.customer.findUnique({ where: { id: data.customerId } });
    console.log('  • found customer:', customer?.id);
    if (!customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    // Validate items
    let subtotal = 0;
    const itemsToCreate: { productId: string; quantity: number; price: number }[] = [];
    const inventoryUpdates: { id: string; quantity: number }[]               = [];
    const historyEntries: {
      itemId: string; action: string; quantity: number; notes: string; userId: string;
    }[]                                                                       = [];

    for (const itm of data.items) {
      console.log('  • validating item:', itm);
      if (!itm.productId || itm.quantity <= 0) {
        return NextResponse.json(
          { error: 'Each item must have a valid productId and quantity > 0' },
          { status: 400 }
        );
      }

      const product = await db.inventoryItem.findUnique({ where: { id: itm.productId } });
      console.log('    – product:', product?.id, 'qty:', product?.quantity);
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
        userId:   ADMIN_USER_ID,
      });
    }

    console.log('  • subtotal:', subtotal);

    // Compute totals & orderNumber
    const discount = data.discount ?? 0;
    const total    = Math.max(0, subtotal - discount);
    const count    = await db.order.count();
    const orderNum = `ORD-${String(count + 1).padStart(5, '0')}`;
    console.log('  • orderNum:', orderNum, 'total:', total);

    // Create in transaction
    const newOrder = await db.$transaction(async (tx) => {
      const ord = await tx.order.create({
        data: {
          orderNumber:  orderNum,
          customerId:   data.customerId,
          subtotal,
          discount,
          tax:     data.tax   ?? 0,
          total,
          status:  'PENDING',
          notes:   data.notes ?? '',
          createdById: ADMIN_USER_ID,      // ← use createdById here
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
      console.log('    – created order.id =', ord.id);

      // Inventory & history
      for (const upd of inventoryUpdates) {
        console.log('    – updating inventory:', upd);
        await tx.inventoryItem.update({ where: { id: upd.id }, data: { quantity: upd.quantity } });
      }
      for (const h of historyEntries) {
        console.log('    – logging history:', h);
        await tx.inventoryHistory.create({ data: h });
      }
      await tx.orderStatusLog.create({
        data: { orderId: ord.id, status: 'PENDING', notes: 'Order created', userId: ADMIN_USER_ID },
      });

      return ord;
    });

    // Low-stock notifications
    for (const upd of inventoryUpdates) {
      const item = await db.inventoryItem.findUnique({ where: { id: upd.id } });
      if (item && item.quantity <= item.reorderLevel) {
        console.log('    – low stock alert for:', item.id);
        await db.notification.create({
          data: {
            type:    'LOW_STOCK',
            title:   `Low Stock Alert: ${item.name}`,
            message: `${item.name} (${item.sku}) below reorder level.`,
            userId:  ADMIN_USER_ID,
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

    console.log('  ✅ POST complete, returning newOrder.id =', newOrder.id);
    return NextResponse.json(newOrder);
  } catch (err: any) {
    console.error('  ❌ POST error:', err);
    return NextResponse.json(
      { error: err.message, stack: err.stack },
      { status: 500 }
    );
  }
}
