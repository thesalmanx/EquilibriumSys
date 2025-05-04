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
    const limit = parseInt(searchParams.get('limit') || '100', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

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
    console.error('[ORDER GET] Error fetching orders:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const data = await req.json();
    console.log('[ORDER POST] Incoming order data:', data);

    if (!data.customerId || !data.items || !data.items.length) {
      return NextResponse.json(
        { error: 'Customer and at least one item are required' },
        { status: 400 }
      );
    }

    const customer = await db.customer.findUnique({
      where: { id: data.customerId },
    });
    if (!customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    let subtotal = 0;
    const itemsToCreate: { productId: string; quantity: number; price: number }[] = [];
    const inventoryUpdates: { id: string; newQty: number }[] = [];
    const inventoryHistoryEntries: {
      itemId: string;
      action: 'REMOVE';
      quantity: number;
      notes: string;
      // Optionally include userId if you pass it in the request:
      // userId?: string;
    }[] = [];
    const lowStockItems: {
      id: string;
      name: string;
      sku: string;
      quantity: number;
      reorderLevel: number;
    }[] = [];

    for (const item of data.items) {
      const product = await db.inventoryItem.findUnique({
        where: { id: item.productId },
      });
      if (!product) {
        return NextResponse.json(
          { error: `Product ${item.productId} not found` },
          { status: 404 }
        );
      }
      if (product.quantity < item.quantity) {
        return NextResponse.json(
          { error: `Not enough stock for ${product.name}` },
          { status: 400 }
        );
      }

      const price = item.price ?? product.price;
      subtotal += price * item.quantity;

      itemsToCreate.push({
        productId: item.productId,
        quantity: item.quantity,
        price,
      });
      inventoryUpdates.push({
        id: product.id,
        newQty: product.quantity - item.quantity,
      });
      inventoryHistoryEntries.push({
        itemId: product.id,
        action: 'REMOVE',
        quantity: item.quantity,
        notes: 'Removed for order',
        // userId: data.userId, // uncomment if you include a userId in the request
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
    const total = Math.max(0, subtotal - discount);
    const orderCount = await db.order.count();
    const orderNumber = `ORD-${String(orderCount + 1).padStart(5, '0')}`;

    const order = await db.$transaction(async (prisma) => {
      const newOrder = await prisma.order.create({
        data: {
          orderNumber,
          customerId: data.customerId,
          subtotal,
          discount,
          tax: data.tax || 0,
          total,
          status: 'PENDING',
          notes: data.notes || '',
          // If you want to track who created the order, add:
          // createdById: data.createdById,
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
        await prisma.inventoryItem.update({
          where: { id: update.id },
          data: { quantity: update.newQty },
        });
      }

      for (const entry of inventoryHistoryEntries) {
        await prisma.inventoryHistory.create({ data: entry });
      }

      await prisma.orderStatusLog.create({
        data: {
          orderId: newOrder.id,
          status: 'PENDING',
          notes: 'Order created',
          // userId: data.userId, // uncomment if tracking user actions
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
          // userId: data.userId, // optional, if provided
          metadata: {
            itemId: item.id,
            sku: item.sku,
            quantity: item.quantity,
            reorderLevel: item.reorderLevel,
          },
        },
      });
    }

    return NextResponse.json(order);
  } catch (error) {
    console.error('[ORDER POST] Error creating order:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Internal Server Error',
        details: JSON.stringify(error),
      },
      { status: 500 }
    );
  }
}
