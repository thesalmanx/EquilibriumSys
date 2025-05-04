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
  let data: any;

  // Parse & log payload
  try {
    data = await req.json();
    console.log('[ORDER POST] Payload:', JSON.stringify(data, null, 2));
  } catch (parseError) {
    console.error('[ORDER POST] JSON parse error:', parseError);
    return NextResponse.json(
      { error: 'Invalid JSON payload', details: `${parseError}` },
      { status: 400 }
    );
  }

  try {
    // Basic validation
    if (!data.customerId || !Array.isArray(data.items) || data.items.length === 0) {
      return NextResponse.json(
        { error: 'Customer and at least one item are required' },
        { status: 400 }
      );
    }

    // Check customer exists
    const customer = await db.customer.findUnique({ where: { id: data.customerId } });
    if (!customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    // Build order details
    let subtotal = 0;
    const itemsToCreate: { productId: string; quantity: number; price: number }[] = [];
    const inventoryUpdates: { id: string; newQty: number }[] = [];
    const inventoryHistoryEntries: any[] = [];
    const lowStockItems: any[] = [];

    for (const item of data.items) {
      const product = await db.inventoryItem.findUnique({ where: { id: item.productId } });
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

      itemsToCreate.push({ productId: item.productId, quantity: item.quantity, price });
      inventoryUpdates.push({ id: product.id, newQty: product.quantity - item.quantity });

      inventoryHistoryEntries.push({
        item: { connect: { id: product.id } },
        action: 'REMOVE',
        quantity: item.quantity,
        notes: 'Removed for order',
        // if you have a user relation on InventoryHistory, uncomment:
        // user: { connect: { id: data.userId } },
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

    // Transaction: create order, update inventory, history, status log
    const newOrder = await db.$transaction(async (prisma) => {
      const created = await prisma.order.create({
        data: {
          orderNumber,
          customerId: data.customerId,
          subtotal,
          discount,
          tax: data.tax || 0,
          total,
          status: 'PENDING',
          notes: data.notes || '',
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

      // apply inventory updates
      for (const u of inventoryUpdates) {
        await prisma.inventoryItem.update({
          where: { id: u.id },
          data: { quantity: u.newQty },
        });
      }

      // create history entries with nested connect
      for (const h of inventoryHistoryEntries) {
        await prisma.inventoryHistory.create({ data: h });
      }

      // log order status
      await prisma.orderStatusLog.create({
        data: {
          orderId: created.id,
          status: 'PENDING',
          notes: 'Order created',
          // user: { connect: { id: data.userId } },
        },
      });

      return created;
    });

    // Outside transaction: low-stock notifications
    for (const item of lowStockItems) {
      await db.notification.create({
        data: {
          type: 'LOW_STOCK',
          title: `Low Stock: ${item.name}`,
          message: `${item.name} is below reorder level.`,
          // user: { connect: { id: data.userId } },
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
  } catch (error) {
    console.error('[ORDER POST] Error creating order:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Internal Server Error',
      },
      { status: 500 }
    );
  }
}
