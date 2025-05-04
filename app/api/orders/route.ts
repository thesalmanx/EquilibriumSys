// app/api/orders/route.ts

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const status    = searchParams.get('status');
    const customerId= searchParams.get('customerId');
    const startDate = searchParams.get('startDate');
    const endDate   = searchParams.get('endDate');
    const search    = searchParams.get('search');
    const limit     = parseInt(searchParams.get('limit')  ?? '100', 10);
    const offset    = parseInt(searchParams.get('offset') ?? '0',   10);

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
              product: { select: { id: true, name: true, sku: true } },
            },
          },
        },
      }),
      db.order.count({ where: filters }),
    ]);

    return NextResponse.json({ orders, total, limit, offset });
  } catch (err) {
    console.error('[ORDER GET]', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  let data: any;
  try {
    data = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
  }

  const { customerId, items, discount = 0, tax = 0, notes = '', paymentMethod = 'CREDIT_CARD' } = data;

  if (!customerId) {
    return NextResponse.json({ error: 'customerId is required' }, { status: 400 });
  }
  if (!Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: 'At least one item is required' }, { status: 400 });
  }

  // Ensure customer exists
  const customer = await db.customer.findUnique({ where: { id: customerId } });
  if (!customer) {
    return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
  }

  // Prepare line items, inventory updates, history entries, low-stock alerts
  let subtotal = 0;
  const itemsToCreate: { productId: string; quantity: number; price: number }[] = [];
  const inventoryUpdates: { id: string; newQty: number }[] = [];
  const historyEntries: any[] = [];
  const lowStockItems: { id: string; name: string; sku: string; quantity: number; reorderLevel: number }[] = [];

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

    itemsToCreate.push({
      productId: line.productId,
      quantity:  line.quantity,
      price,
    });

    const newQty = product.quantity - line.quantity;
    inventoryUpdates.push({ id: product.id, newQty });

    historyEntries.push({
      item:     { connect: { id: product.id } },
      action:   'REMOVE',
      quantity: line.quantity,
      notes:    'Removed for order',
    });

    if (newQty <= product.reorderLevel) {
      lowStockItems.push({
        id:           product.id,
        name:         product.name,
        sku:          product.sku,
        quantity:     newQty,
        reorderLevel: product.reorderLevel,
      });
    }
  }

  const total = Math.max(0, subtotal - discount);
  const count = await db.order.count();
  const orderNumber = `ORD-${String(count + 1).padStart(5, '0')}`;

  try {
    const newOrder = await db.$transaction(async (prisma) => {
      // 1) Create the order + payment + items
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

      // 2) Adjust inventory
      for (const u of inventoryUpdates) {
        await prisma.inventoryItem.update({
          where: { id: u.id },
          data:  { quantity: u.newQty },
        });
      }

      // 3) Write inventory history
      for (const h of historyEntries) {
        await prisma.inventoryHistory.create({ data: h });
      }

      // 4) Log the status change
      await prisma.orderStatusLog.create({
        data: {
          orderId: created.id,
          status:  'PENDING',
          notes:   'Order created',
        },
      });

      return created;
    });

    // (Optional) handle low-stock notifications here if you have somewhere to attach them

    return NextResponse.json(newOrder);
  } catch (err) {
    console.error('[ORDER POST]', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
