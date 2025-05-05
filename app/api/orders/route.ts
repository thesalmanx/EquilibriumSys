// app/api/orders/route.ts
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession }        from 'next-auth/next';
import { authOptions }             from '@/app/api/auth/[...nextauth]/route';
import { db }                      from '@/lib/db';

console.log('▶️ /api/orders handler loaded', {
  NODE_ENV:    process.env.NODE_ENV,
  NEXTAUTH_URL: process.env.NEXTAUTH_URL,
});

export async function GET(request: NextRequest) {
  console.log('🔍 GET /api/orders called:', request.nextUrl.href);
  try {
    const session = await getServerSession(authOptions);
    console.log('   session:', session);
    if (!session) {
      console.error('   ⛔ GET Unauthorized – no session');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const params     = request.nextUrl.searchParams;
    const status     = params.get('status');
    const customerId = params.get('customerId');
    const startDate  = params.get('startDate');
    const endDate    = params.get('endDate');
    const search     = params.get('search');
    const limit      = parseInt(params.get('limit')  || '100', 10);
    const offset     = parseInt(params.get('offset') || '0',   10);

    console.log('   query params:', { status, customerId, startDate, endDate, search, limit, offset });

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

    console.log('   Prisma where filter:', where);

    const [orders, total] = await Promise.all([
      db.order.findMany({
        where: where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
        include: {
          customer: { select: { id: true, name: true, email: true } },
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

    console.log(`   ✅ GET returning ${orders.length} orders (total=${total})`);
    return NextResponse.json({ orders, total, limit, offset });
  } catch (err) {
    console.error('   ❌ GET /api/orders error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  console.log('✏️ POST /api/orders called:', request.nextUrl.href);
  try {
    const session = await getServerSession(authOptions);
    console.log('   session:', session);
    if (!session) {
      console.error('   ⛔ POST Unauthorized – no session');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.log('   session.user.role =', session.user.role);
    if (!['ADMIN', 'STAFF'].includes(session.user.role!)) {
      console.error('   ⛔ POST Forbidden – role is not ADMIN/STAFF:', session.user.role);
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    let data: any;
    try {
      data = await request.json();
      console.log('   request.body:', data);
    } catch (parseErr) {
      console.error('   ⛔ POST Bad Request – JSON parse error:', parseErr);
      return NextResponse.json({ error: 'Bad Request' }, { status: 400 });
    }

    if (!data.customerId || !Array.isArray(data.items) || data.items.length === 0) {
      console.error('   ⛔ POST Bad Request – missing customerId or items');
      return NextResponse.json(
        { error: 'Customer and at least one item are required' },
        { status: 400 }
      );
    }

    // Validate customer
    const customer = await db.customer.findUnique({ where: { id: data.customerId } });
    if (!customer) {
      console.error('   ⛔ POST Customer not found:', data.customerId);
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    // Validate items & prepare transaction
    let subtotal = 0;
    const itemsToCreate: any[] = [];
    const inventoryUpdates: { id: string; quantity: number }[] = [];
    const historyEntries: any[] = [];

    for (const itm of data.items) {
      console.log('   validating item:', itm);
      if (!itm.productId || itm.quantity <= 0) {
        console.error('   ⛔ POST Invalid item data:', itm);
        return NextResponse.json(
          { error: 'Each item must have a valid productId and quantity > 0' },
          { status: 400 }
        );
      }

      const product = await db.inventoryItem.findUnique({ where: { id: itm.productId } });
      if (!product) {
        console.error('   ⛔ POST Product not found:', itm.productId);
        return NextResponse.json({ error: `Product ${itm.productId} not found` }, { status: 404 });
      }
      if (product.quantity < itm.quantity) {
        console.error('   ⛔ POST Insufficient stock for:', product.id);
        return NextResponse.json(
          { error: `Not enough stock for ${product.name}. Available: ${product.quantity}` },
          { status: 400 }
        );
      }

      const price = itm.price ?? product.price;
      subtotal  += price * itm.quantity;

      itemsToCreate.push({ productId: itm.productId, quantity: itm.quantity, price });
      inventoryUpdates.push({ id: product.id, quantity: product.quantity - itm.quantity });
      historyEntries.push({
        itemId:   product.id,
        action:   'REMOVE',
        quantity: itm.quantity,
        notes:    'Removed for order',
        userId:   session.user.id,
      });
    }

    const discount = data.discount ?? 0;
    const total    = Math.max(0, subtotal - discount);
    const count    = await db.order.count();
    const orderNum = `ORD-${String(count + 1).padStart(5, '0')}`;

    console.log('   creating order:', { subtotal, discount, total, orderNum });

    // Transaction
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
          createdBy: { connect: { id: session.user.id } },
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
      console.log('   order record created:', ord.id);

      for (const upd of inventoryUpdates) {
        console.log('   updating inventory:', upd);
        await tx.inventoryItem.update({ where: { id: upd.id }, data: { quantity: upd.quantity } });
      }
      for (const h of historyEntries) {
        console.log('   logging inventory history:', h);
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

    console.log('   transaction complete, newOrder.id =', newOrder.id);

    // Low-stock notifications
    for (const upd of inventoryUpdates) {
      const item = await db.inventoryItem.findUnique({ where: { id: upd.id } });
      if (item && item.quantity <= item.reorderLevel) {
        console.log('   low stock alert for:', item.id);
        await db.notification.create({
          data: {
            type:    'LOW_STOCK',
            title:   `Low Stock Alert: ${item.name}`,
            message: `${item.name} (${item.sku}) below reorder level.`,
            userId:  session.user.id,
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

    console.log('   ✅ POST completed successfully:', newOrder.id);
    return NextResponse.json(newOrder);
  } catch (err) {
    console.error('   ❌ POST /api/orders error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
