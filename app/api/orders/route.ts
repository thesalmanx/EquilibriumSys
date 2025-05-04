// app/api/orders/route.ts
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const customerId = searchParams.get('customerId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const search = searchParams.get('search');
    const limit = parseInt(searchParams.get('limit') ?? '100', 10);
    const offset = parseInt(searchParams.get('offset') ?? '0', 10);

    const filters: any = {};
    if (status) filters.status = status;
    if (customerId) filters.customerId = customerId;

    if (startDate || endDate) {
      filters.createdAt = {};
      if (startDate) filters.createdAt.gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setDate(end.getDate() + 1);
        filters.createdAt.lt = end;
      }
    }

    if (search) {
      filters.OR = [
        { orderNumber: { contains: search, mode: 'insensitive' } },
        { customer: { name: { contains: search, mode: 'insensitive' } } },
        { customer: { email: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const [orders, total] = await Promise.all([
      db.order.findMany({
        where: filters,
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
    console.log('[ORDER POST] payload:', data);
  } catch (parseErr) {
    console.error('[ORDER POST] JSON parse error:', parseErr);
    return NextResponse.json(
      { error: 'Invalid JSON' },
      { status: 400 }
    );
  }

  const {
    customerId,
    items,
    discount = 0,
    tax = 0,
    notes = '',
    paymentMethod = 'CREDIT_CARD',
    userId,
  } = data;

  if (!userId) {
    return NextResponse.json(
      { error: 'Missing userId in payload' },
      { status: 400 }
    );
  }

  try {
    // verify user and customer
    const [user, customer] = await Promise.all([
      db.user.findUnique({ where: { id: userId } }),
      db.customer.findUnique({ where: { id: customerId } }),
    ]);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    if (!customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }
    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: 'At least one item is required' },
        { status: 400 }
      );
    }

    // build line items, inventory ops, history entries, low-stock list
    let subtotal = 0;
    const itemsToCreate: { productId: string; quantity: number; price: number }[] = [];
    const inventoryUpdates: { id: string; newQty: number }[] = [];
    const historyEntries: any[] = [];
    const lowStockItems: any[] = [];

    for (const line of items) {
      const product = await db.inventoryItem.findUnique({ where: { id: line.productId } });
      if (!product) {
        return NextResponse.json(
          { error: `Product ${line.productId} not found` },
          { status: 404 }
        );
      }
      if (product.quantity < line.quantity) {
        return NextResponse.json(
          { error: `Insufficient stock for ${product.name}` },
          { status: 400 }
        );
      }

      const price = line.price ?? product.price;
      subtotal += price * line.quantity;

      itemsToCreate.push({
        productId: line.productId,
        quantity: line.quantity,
        price,
      });

      const newQty = product.quantity - line.quantity;
      inventoryUpdates.push({ id: product.id, newQty });

      historyEntries.push({
        item: { connect: { id: product.id } },
        user: { connect: { id: userId } },
        action: 'REMOVE',
        quantity: line.quantity,
        notes: 'Removed for order',
      });

      if (newQty <= product.reorderLevel) {
        lowStockItems.push({
          id: product.id,
          name: product.name,
          sku: product.sku,
          quantity: newQty,
          reorderLevel: product.reorderLevel,
        });
      }
    }

    const total = Math.max(0, subtotal - discount);
    const orderCount = await db.order.count();
    const orderNumber = `ORD-${String(orderCount + 1).padStart(5, '0')}`;

    // run all writes in a transaction
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
          createdById: userId,
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
          items: { include: { product: true } },
          payment: true,
        },
      });

      // update inventory
      for (const upd of inventoryUpdates) {
        await prisma.inventoryItem.update({
          where: { id: upd.id },
          data: { quantity: upd.newQty },
        });
      }

      // write history entries
      for (const h of historyEntries) {
        await prisma.inventoryHistory.create({ data: h });
      }

      // log order status
      await prisma.orderStatusLog.create({
        data: {
          orderId: created.id,
          status: 'PENDING',
          notes: 'Order created',
          user: { connect: { id: userId } },
        },
      });

      return created;
    });

    // send low-stock notifications
    for (const item of lowStockItems) {
      await db.notification.create({
        data: {
          type: 'LOW_STOCK',
          title: `Low Stock: ${item.name}`,
          message: `${item.name} is below reorder level.`,
          user: { connect: { id: userId } },
          metadata: {
            itemId: item.id,
            sku: item.sku,
            quantity: item.quantity,
            reorderLevel: item.reorderLevel,
          },
        },
      });
    }

    return NextResponse.json(newOrder);
  } catch (err) {
    console.error('[ORDER POST]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal Server Error' },
      { status: 500 }
    );
  }
}
