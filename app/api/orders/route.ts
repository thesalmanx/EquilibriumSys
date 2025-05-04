import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

const isDev = process.env.NODE_ENV !== 'production';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    // … your existing GET logic unchanged …
    // (omitted here for brevity)
    return NextResponse.json({ orders, total, limit, offset });
  } catch (error) {
    console.error('[ORDER GET] Error fetching orders:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  let data: any;
  // 1️⃣ Parse & log the incoming payload
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
    // 2️⃣ Basic validation
    if (!data.customerId || !Array.isArray(data.items) || data.items.length === 0) {
      return NextResponse.json(
        { error: 'Customer and at least one item are required' },
        { status: 400 }
      );
    }

    // 3️⃣ Check customer exists
    const customer = await db.customer.findUnique({ where: { id: data.customerId } });
    if (!customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    // 4️⃣ Build order details
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
        itemId: product.id,
        action: 'REMOVE',
        quantity: item.quantity,
        notes: 'Removed for order',
        // userId: data.userId, // if you’re passing the user in the payload
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

    // 5️⃣ Transaction: create order, update inventory, history, status log
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

      for (const u of inventoryUpdates) {
        await prisma.inventoryItem.update({
          where: { id: u.id },
          data: { quantity: u.newQty },
        });
      }
      for (const h of inventoryHistoryEntries) {
        await prisma.inventoryHistory.create({ data: h });
      }
      await prisma.orderStatusLog.create({
        data: {
          orderId: created.id,
          status: 'PENDING',
          notes: 'Order created',
          // userId: data.userId,
        },
      });
      return created;
    });

    // 6️⃣ Outside transaction: low-stock notifications
    for (const item of lowStockItems) {
      await db.notification.create({
        data: {
          type: 'LOW_STOCK',
          title: `Low Stock: ${item.name}`,
          message: `${item.name} is below reorder level.`,
          // userId: data.userId,
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
    // 7️⃣ Enhanced error logging
    console.error('[ORDER POST] Error creating order:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Internal Server Error',
        ...(isDev && error instanceof Error ? { stack: error.stack } : {}),
      },
      { status: 500 }
    );
  }
}
