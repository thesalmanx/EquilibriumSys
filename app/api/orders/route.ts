export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

async function getAdminUserId() {
  const admin = await db.user.findFirst({ where: { role: 'ADMIN' } });
  if (!admin) throw new Error('Admin user not found');
  return admin.id;
}

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const status = params.get('status');
    const customerId = params.get('customerId');
    const search = params.get('search');
    const limit = parseInt(params.get('limit') || '100');
    const offset = parseInt(params.get('offset') || '0');

    const where: any = {};
    if (status) where.status = status;
    if (customerId) where.customerId = customerId;
    if (search) {
      where.OR = [
        { orderNumber: { contains: search, mode: 'insensitive' } },
        { customer: { name: { contains: search, mode: 'insensitive' } } },
        { customer: { email: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const [orders, total] = await Promise.all([
      db.order.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
        include: {
          customer: { include: { address: true } },
          items: { include: { product: true } },
          payment: true,
          statusHistory: {
            include: { user: { select: { id: true, name: true, email: true } } },
            orderBy: { createdAt: 'asc' },
          },
        },
      }),
      db.order.count({ where }),
    ]);

    return NextResponse.json({ orders, total });
  } catch (err: any) {
    console.error('GET /api/orders error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    const adminUserId = await getAdminUserId();

    if (!data.customerId || !Array.isArray(data.items) || data.items.length === 0) {
      return NextResponse.json({ error: 'Customer and items are required' }, { status: 400 });
    }

    const customer = await db.customer.findUnique({ where: { id: data.customerId } });
    if (!customer) return NextResponse.json({ error: 'Customer not found' }, { status: 404 });

    let subtotal = 0;
    const itemsToCreate: any[] = [];
    const inventoryUpdates: any[] = [];
    const historyEntries: any[] = [];

    for (const item of data.items) {
      const product = await db.inventoryItem.findUnique({ where: { id: item.productId } });
      if (!product) return NextResponse.json({ error: 'Product not found' }, { status: 404 });
      if (product.quantity < item.quantity) {
        return NextResponse.json({ error: `Not enough stock for ${product.name}` }, { status: 400 });
      }

      const price = item.price ?? product.price;
      subtotal += price * item.quantity;

      itemsToCreate.push({ productId: item.productId, quantity: item.quantity, price });
      inventoryUpdates.push({ id: product.id, quantity: product.quantity - item.quantity });
      historyEntries.push({
        itemId: product.id,
        action: 'REMOVE',
        quantity: item.quantity,
        notes: 'Used in order',
        userId: adminUserId,
      });
    }

    const discount = data.discount ?? 0;
    const tax = data.tax ?? 0;
    const total = subtotal - discount + tax;
    const count = await db.order.count();
    const orderNumber = `ORD-${String(count + 1).padStart(5, '0')}`;

    const order = await db.$transaction(
      async (tx) => {
      const newOrder = await tx.order.create({
        data: {
          orderNumber,
          customerId: data.customerId,
          subtotal,
          discount,
          tax,
          total,
          notes: data.notes || '',
          status: 'PENDING',
          createdById: adminUserId,
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

      for (const entry of historyEntries) {
        await tx.inventoryHistory.create({ data: entry });
      }

      await tx.orderStatusLog.create({
        data: {
          orderId: newOrder.id,
          status: 'PENDING',
          notes: 'Order created',
          userId: adminUserId,
        },
      });

      return newOrder;
         },
         {
           // bump the default 5 s timeout to 15 s:
           timeout: 15_000,
           // optional: wait up to 2 s to acquire a DB connection
           maxWait: 2_000,
          }
        );

    return NextResponse.json(order);
  } catch (err: any) {
    console.error('POST /api/orders error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
