import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { db } from '@/lib/db';
import { sendMail } from '@/lib/mail';
import { generateReceiptHtml } from '@/lib/receipt-generator';

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const order = await db.order.findUnique({
      where: { id: params.id },
      include: {
        customer: {
          include: {
            address: true,
          },
        },
        items: {
          include: {
            product: true,
          },
        },
        payment: true,
        statusHistory: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
          orderBy: {
            createdAt: 'asc',
          },
        },
      },
    });
    
    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }
    
    return NextResponse.json(order);
  } catch (error) {
    console.error('Error fetching order:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Only admins and staff can update orders
    if (session.user.role !== 'ADMIN' && session.user.role !== 'STAFF') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    
    const data = await req.json();
    
    // Find order
    const order = await db.order.findUnique({
      where: { id: params.id },
    });
    
    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }
    
    // Check if status is being updated
// Check if status is being updated
if (data.status && data.status !== order.status) {
  await db.orderStatusLog.create({
    data: {
      orderId: order.id,
      status: data.status,
      notes: data.notes || `Status updated to ${data.status}`,
      userId: session.user.id,
    },
  });

  // If payment is being marked as PAID, update the payment record
  if (data.status === 'DELIVERED' || data.status === 'COMPLETED') {
    await db.payment.updateMany({
      where: { orderId: order.id },
      data: {
        status: 'PAID',
        date: new Date(),
      },
    });
  }
}

    
    // Update order
    const updatedOrder = await db.order.update({
      where: { id: params.id },
      data: {
        notes: data.notes !== undefined ? data.notes : undefined,
        status: data.status !== undefined ? data.status : undefined,
        updatedAt: new Date(),
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
    
    return NextResponse.json(updatedOrder);
  } catch (error) {
    console.error('Error updating order:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Only admins can delete orders
    if (session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    
    // Check if order exists
    const order = await db.order.findUnique({
      where: { id: params.id },
      include: {
        items: true,
      },
    });
    
    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }
    
    // Make sure we're not deleting completed orders
    if (order.status === 'DELIVERED' || order.status === 'COMPLETED') {
      return NextResponse.json(
        { error: 'Cannot delete completed orders' },
        { status: 400 }
      );
    }
    
    // If the order has items, restore inventory
    if (order.items.length > 0) {
      await db.$transaction(async (prisma) => {
        for (const item of order.items) {
          // Increase inventory quantity
          const product = await prisma.inventoryItem.findUnique({
            where: { id: item.productId },
          });
          
          if (product) {
            await prisma.inventoryItem.update({
              where: { id: product.id },
              data: { quantity: product.quantity + item.quantity },
            });
            
            // Record inventory history
            await prisma.inventoryHistory.create({
              data: {
                itemId: product.id,
                action: 'ADD',
                quantity: item.quantity,
                notes: `Returned to inventory due to order cancellation`,
                userId: session.user.id,
              },
            });
          }
        }
        
        // Delete order status entries
        await prisma.orderStatusLog.deleteMany({
          where: { orderId: params.id },
        });
        
        // Delete order items
        await prisma.orderItem.deleteMany({
          where: { orderId: params.id },
        });
        
        // Delete payment
        await prisma.payment.deleteMany({
          where: { orderId: params.id },
        });
        
        // Delete the order
        await prisma.order.delete({
          where: { id: params.id },
        });
      });
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting order:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const { action } = await req.json();
    
    if (action === 'sendReceipt') {
      const order = await db.order.findUnique({
        where: { id: params.id },
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
      
      if (!order) {
        return NextResponse.json({ error: 'Order not found' }, { status: 404 });
      }
      
      // Generate receipt HTML
      const receiptHtml = generateReceiptHtml(order);
      
      // Send email
      await sendMail({
        to: order.customer.email,
        subject: `Your Receipt for Order #${order.orderNumber}`,
        html: receiptHtml,
      });
      
      return NextResponse.json({ success: true, message: 'Receipt sent successfully' });
    }
    
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Error processing order action:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}