import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { db } from '@/lib/db';

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const customerId = searchParams.get('customerId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const search = searchParams.get('search');
    const limit = parseInt(searchParams.get('limit') || '100');
    const offset = parseInt(searchParams.get('offset') || '0');
    
    // Build filters
    const filters: any = {};
    
    if (status) {
      filters.status = status;
    }
    
    if (customerId) {
      filters.customerId = customerId;
    }
    
    if (startDate || endDate) {
      filters.createdAt = {};
      
      if (startDate) {
        filters.createdAt.gte = new Date(startDate);
      }
      
      if (endDate) {
        // Add one day to include the end date
        const endDateObj = new Date(endDate);
        endDateObj.setDate(endDateObj.getDate() + 1);
        filters.createdAt.lt = endDateObj;
      }
    }
    
    if (search) {
      filters.OR = [
        { orderNumber: { contains: search, mode: 'insensitive' } },
        { customer: { name: { contains: search, mode: 'insensitive' } } },
        { customer: { email: { contains: search, mode: 'insensitive' } } },
      ];
    }
    
    // Get orders with total count
    const [orders, total] = await Promise.all([
      db.order.findMany({
        where: filters,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
        include: {
          customer: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          items: {
            select: {
              id: true,
              quantity: true,
              price: true,
              product: {
                select: {
                  id: true,
                  name: true,
                  sku: true,
                },
              },
            },
          },
        },
      }),
      db.order.count({ where: filters }),
    ]);
    
    return NextResponse.json({
      orders,
      total,
      limit,
      offset,
    });
  } catch (error) {
    console.error('Error creating order:', error);
    console.error('Error fetching orders:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Only admins and staff can create orders
    if (session.user.role !== 'ADMIN' && session.user.role !== 'STAFF') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    
    const data = await req.json();
    
    // Validate required fields
    if (!data.customerId || !data.items || !data.items.length) {
      return NextResponse.json(
        { error: 'Customer and at least one item are required' },
        { status: 400 }
      );
    }
    
    // Check if customer exists
    const customer = await db.customer.findUnique({
      where: { id: data.customerId },
    });
    
    if (!customer) {
      return NextResponse.json(
        { error: 'Customer not found' },
        { status: 404 }
      );
    }
    
    // Validate items and calculate totals
    let subtotal = 0;
    const itemsToCreate = [];
    const inventoryUpdates = [];
    const inventoryHistoryEntries = [];
    
    for (const item of data.items) {
      if (!item.productId || !item.quantity || item.quantity <= 0) {
        return NextResponse.json(
          { error: 'Each item must have a product ID and positive quantity' },
          { status: 400 }
        );
      }
      
      // Get product to validate it exists and has enough stock
      const product = await db.inventoryItem.findUnique({
        where: { id: item.productId },
      });
      
      if (!product) {
        return NextResponse.json(
          { error: `Product with ID ${item.productId} not found` },
          { status: 404 }
        );
      }
      
      if (product.quantity < item.quantity) {
        return NextResponse.json(
          { error: `Not enough stock for ${product.name}. Available: ${product.quantity}` },
          { status: 400 }
        );
      }
      
      // Use provided price or product price
      const price = item.price || product.price;
      
      // Add to total
      subtotal += price * item.quantity;
      
      // Prepare item for creation
      itemsToCreate.push({
        productId: item.productId,
        quantity: item.quantity,
        price: price,
      });
      
      // Prepare inventory update
      inventoryUpdates.push({
        id: product.id,
        quantity: product.quantity - item.quantity,
      });
      
      // Prepare inventory history entry
      inventoryHistoryEntries.push({
        itemId: product.id,
        action: 'REMOVE',
        quantity: item.quantity,
        notes: 'Removed from inventory for order',
        userId: session.user.id,
      });
    }
    
    // Apply discount if provided
    const discount = data.discount || 0;
    const total = Math.max(0, subtotal - discount);
    
    // Generate order number
    const orderCount = await db.order.count();
    const orderNumber = `ORD-${String(orderCount + 1).padStart(5, '0')}`;
    
    // Create order in a transaction
    const order = await db.$transaction(async (prisma) => {
      // Create the order
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
          createdBy: {
            connect: { id: session.user.id }
          },
          payment: {
            create: {
              method: data.paymentMethod || 'CREDIT_CARD',
              status: 'PENDING',
              amount: total,
            },
          },
          items: {
            create: itemsToCreate,
          },
        },
        include: {
          customer: true,
          items: {
            include: {
              product: true,
            },
          },
          payment: true,
        },
      });
      
      // Update inventory for each item
      for (const update of inventoryUpdates) {
        await prisma.inventoryItem.update({
          where: { id: update.id },
          data: { quantity: update.quantity },
        });
      }
      
      // Record inventory history
      for (const entry of inventoryHistoryEntries) {
        await prisma.inventoryHistory.create({
          data: entry,
        });
      }
      
      // Create order status entry
      await prisma.orderStatusLog.create({
        data: {
          orderId: newOrder.id,
          status: 'PENDING',
          notes: 'Order created',
          userId: session.user.id,
        },
      });
      
      return newOrder;
    });
    
    // Check for low stock after inventory updates
    for (const update of inventoryUpdates) {
      const item = await db.inventoryItem.findUnique({
        where: { id: update.id },
      });
      
      if (item && item.quantity <= item.reorderLevel) {
        await db.notification.create({
          data: {
            type: 'LOW_STOCK',
            title: `Low Stock Alert: ${item.name}`,
            message: `The inventory for ${item.name} (${item.sku}) is below the reorder level.`,
            userId: session.user.id,
            metadata: {
              itemId: item.id,
              sku: item.sku,
              quantity: item.quantity,
              reorderLevel: item.reorderLevel,
            },
          },
        });
      }
    }
    
    return NextResponse.json(order);
  } catch (error) {
    console.error('Error creating order:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}