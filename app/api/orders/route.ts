import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

const isDev = process.env.NODE_ENV !== 'production';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const status     = searchParams.get('status');
    const customerId = searchParams.get('customerId');
    const startDate  = searchParams.get('startDate');
    const endDate    = searchParams.get('endDate');
    const search     = searchParams.get('search');
    const limit      = parseInt(searchParams.get('limit')  ?? '100', 10);
    const offset     = parseInt(searchParams.get('offset') ?? '0',   10);

    const filters: any = {};
    if (status)     filters.status     = status;
    if (customerId) filters.customerId = customerId;

    if (startDate || endDate) {
      filters.createdAt = {};
      if (startDate) filters.createdAt.gte = new Date(startDate);
      if (endDate) {
        const d = new Date(endDate);
        d.setDate(d.getDate() + 1);
        filters.createdAt.lt = d;
      }
    }

    if (search) {
      filters.OR = [
        { orderNumber: { contains: search, mode: 'insensitive' } },
        { customer:    { name:       { contains: search, mode: 'insensitive' } } },
        { customer:    { email:      { contains: search, mode: 'insensitive' } } },
      ];
    }

    const [orders, total] = await Promise.all([
      db.order.findMany({
        where:    filters,
        orderBy: { createdAt: 'desc' },
        take:     limit,
        skip:     offset,
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
      db.order.count({ where: filters }),
    ]);

    return NextResponse.json({ orders, total, limit, offset });
  } catch (error: any) {
    console.error('[ORDER GET] Error fetching orders:', error);
    return NextResponse.json(
      {
        error: 'Internal Server Error',
        ...(isDev ? { message: error.message, stack: error.stack } : {}),
      },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  let data: any;
  try {
    data = await req.json();
    console.log('[ORDER POST] payload:', data);
  } catch (parseErr: any) {
    console.error('[ORDER POST] JSON parse error:', parseErr);
    return NextResponse.json(
      { error: 'Invalid JSON payload', ...(isDev ? { message: parseErr.message, stack: parseErr.stack } : {}) },
      { status: 400 }
    );
  }

  const { customerId, items, discount = 0, tax = 0, notes = '', paymentMethod = 'CREDIT_CARD' } = data;

  if (!customerId) {
    return NextResponse.json({ error: 'customerId is required' }, { status: 400 });
  }
  if (!Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: 'At least one item is required' }, { status: 400 });
  }

  // verify customer exists
  const customer = await db.customer.findUnique({ where: { id: customerId } });
  if (!customer) {
    return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
  }

  // build everything
  let subtotal = 0;
  const itemsToCreate: { productId: string; quantity: number; price: number }[] = [];
  const inventoryUpdates: { id: string; newQty: number }[] = [];
  const historyEntries: any[] = [];

  try {
    for (const line of items) {
      const product = await db.inventoryItem.findUnique({ where: { id: line.productId } });
      if (!product) {
        return NextResponse.json({ error: `Product ${line.productId} not found` }, { status: 404 });
      }
      if (product.quantity < line.quantity) {
        return NextResponse.json({ error: `Insufficient stock for ${product.name}` }, { status: 400 });
      }

      const price = line.price ?? product.price;
      subtotal += price * line.quantity;

      itemsToCreate.push({ productId: line.productId, quantity: line.quantity, price });
      const newQty = product.quantity - line.quantity;
      inventoryUpdates.push({ id: product.id, newQty });

      historyEntries.push({
        item:     { connect: { id: product.id } },
        action:   'REMOVE',
        quantity: line.quantity,
        notes:    'Removed for order',
      });
    }

    const total = Math.max(0, subtotal - discount);
    const count = await db.order.count();
    const orderNumber = `ORD-${String(count + 1).padStart(5, '0')}`;

    const newOrder = await db.$transaction(async (prisma) => {
      const created = await prisma.order.create({
        data: {
          orderNumber,
          customerId,
          subtotal,
          discount,
          tax,
          total,
          status: 'PENDING',
          notes,
          payment: {
            create: {
              method: paymentMethod,
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

      // adjust inventory
      for (const u of inventoryUpdates) {
        await prisma.inventoryItem.update({
          where: { id: u.id },
          data:  { quantity: u.newQty },
        });
      }

      // write history
      for (const h of historyEntries) {
        await prisma.inventoryHistory.create({ data: h });
      }

      // log status
      await prisma.orderStatusLog.create({
        data: {
          orderId: created.id,
          status:  'PENDING',
          notes:   'Order created',
        },
      });

      return created;
    });

    return NextResponse.json(newOrder);
  } catch (error: any) {
    console.error('[ORDER POST] Error creating order:', error);
    return NextResponse.json(
      {
        error: 'Internal Server Error',
        ...(isDev ? { message: error.message, stack: error.stack } : {}),
      },
      { status: 500 }
    );
  }
}
