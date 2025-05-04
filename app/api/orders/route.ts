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
    const limit = parseInt(searchParams.get('limit') || '100');
    const offset = parseInt(searchParams.get('offset') || '0');

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
          customer: {
            select: { id: true, name: true, email: true },
          },
          items: {
            select: {
              id: true,
              quantity: true,
              price: true,
              product: {
                select: { id: true, name: true, sku: true },
              },
            },
          },
        },
      }),
      db.order.count({ where: filters }),
    ]);

    return NextResponse.json({ orders, total, limit, offset });
  } catch (error) {
    console.error('[ORDER GET] Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const data = await req.json();

    if (!data.customerId || !data.items?.length) {
      return NextResponse.json({ error: 'Customer and at least one item required' }, { status: 400 });
    }

    const customer = await db.customer.findUnique({ where: { id: data.customerId } });
    if (!customer) return NextResponse.json({ error: 'Customer not found' }, { status: 404 });

    let subtotal = 0;
    const itemsToCreate = [];
    const inventoryUpdates = [];
    const inventoryHistoryEntries = [];
    const lowStockItems: any[] = [];

    for (const item of data.items) {
      const product = await db.inventoryItem.findUnique({ where: { id: item.productId } });
      if (!product) return NextResponse.json({ error: `Product ${item.productId} not found` }, { status: 404 });
      if (product.quantity < item.quantity) {
        return NextResponse.json({ error: `Insufficient stock for ${product.name}` }, { status: 400 });
      }

      const price = item.price || product.price;
      subtotal += price * item.quantity;

      itemsToCreate.push({ productId: item.productId, quantity: item.quantity, price });
      inventoryUpdates.push({ id: product.id, newQty: product.quantity - item.quantity });
      inventoryHistoryEntries.push({
        itemId: product.id,
        action: 'REMOVE',
        quantity: item.quantity,
        notes: 'Removed for order',
        userId: null,
      });

      if (product.quantity - item.quantity <= product.reorderLevel) {
        lowStockItems.push({
          id: product.id,
          name: product.name,
          sku: product.sku,
          quantity: product.quantity - item.quantity,
          reorderLevel: product.reorderLevel,
        });
      }
    }

    const discount = data.discount || 0;
    const tax = data.tax || 0;
    const total = Math.max(0, subtotal - discount + tax);
    const orderNumber = `ORD-${String(await db.order.count() + 1).padStart(5, '0')}`;

    const order = await db.$transaction(async (tx) => {
      const newOrder = await tx.order.create({
        data: {
          orderNumber,
          customerId: data.customerId,
          subtotal,
          discount,
          tax,
          total,
          status: 'PENDING',
          notes: data.notes || '',
          createdById: null,
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

      for (const update of inventoryUpdates) {
        await tx.inventoryItem.update({
          where: { id: update.id },
          data: { quantity: update.newQty },
        });
      }

      for (const entry of inventoryHistoryEntries) {
        await tx.inventoryHistory.create({ data: entry });
      }

      await tx.orderStatusLog.create({
        data: {
          orderId: newOrder.id,
          status: 'PENDING',
          notes: 'Order created',
          userId: null,
        },
      });

      return newOrder;
    });

    for (const item of lowStockItems) {
      await db.notification.create({
        data: {
          type: 'LOW_STOCK',
          title: `Low Stock: ${item.name}`,
          message: `${item.name} is below reorder level.`,
          userId: null,
          metadata: item,
        },
      });
    }

    return NextResponse.json(order);
  } catch (error) {
    console.error('[ORDER POST] Fatal error:', error);
    return NextResponse.json({
      error: 'Internal Server Error',
      details: error instanceof Error ? error.message : 'Unknown',
    }, { status: 500 });
  }
}
