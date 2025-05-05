// app/api/orders/[id]/route.ts
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession }           from 'next-auth/next';
import { authOptions }                from '@/app/api/auth/[...nextauth]/route';
import { db }                         from '@/lib/db';
import { sendMail }                   from '@/lib/mail';
import { generateReceiptHtml }        from '@/lib/receipt-generator';

type Params = { params: { id: string } };

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const order = await db.order.findUnique({
      where: { id: params.id },
      include: {
        customer: {
          include: { address: true },
        },
        items: {
          include: { product: true },
        },
        payment: true,
        statusHistory: {
          include: {
            user: { select: { id: true, name: true, email: true } },
          },
          orderBy: { createdAt: 'asc' },
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

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!['ADMIN', 'STAFF'].includes(session.user.role!)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const data = await request.json();
    const existing = await db.order.findUnique({ where: { id: params.id } });
    if (!existing) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    // log status change + mark paid if delivered/completed
    if (data.status && data.status !== existing.status) {
      await db.orderStatusLog.create({
        data: {
          orderId: existing.id,
          status:  data.status,
          notes:   data.notes || `Status updated to ${data.status}`,
          userId:  session.user.id,
        },
      });

      if (['DELIVERED', 'COMPLETED'].includes(data.status)) {
        await db.payment.updateMany({
          where: { orderId: existing.id },
          data:  { status: 'PAID', date: new Date() },
        });
      }
    }

    const updated = await db.order.update({
      where: { id: params.id },
      data: {
        notes:     data.notes   !== undefined ? data.notes   : undefined,
        status:    data.status  !== undefined ? data.status  : undefined,
        updatedAt: new Date(),
      },
      include: {
        customer: true,
        items:    { include: { product: true } },
        payment:  true,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Error updating order:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const order = await db.order.findUnique({
      where: { id: params.id },
      include: { items: true },
    });
    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }
    if (['DELIVERED', 'COMPLETED'].includes(order.status)) {
      return NextResponse.json(
        { error: 'Cannot delete completed orders' },
        { status: 400 }
      );
    }

    if (order.items.length > 0) {
      await db.$transaction(async (tx) => {
        for (const item of order.items) {
          const prod = await tx.inventoryItem.findUnique({ where: { id: item.productId } });
          if (prod) {
            await tx.inventoryItem.update({
              where: { id: prod.id },
              data:  { quantity: prod.quantity + item.quantity },
            });
            await tx.inventoryHistory.create({
              data: {
                itemId:   prod.id,
                action:   'ADD',
                quantity: item.quantity,
                notes:    'Returned to inventory due to order cancellation',
                userId:   session.user.id,
              },
            });
          }
        }

        await tx.orderStatusLog.deleteMany({ where: { orderId: order.id } });
        await tx.orderItem.deleteMany({ where: { orderId: order.id } });
        await tx.payment.deleteMany({ where: { orderId: order.id } });
        await tx.order.delete({ where: { id: order.id } });
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting order:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: Params) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { action } = await request.json();
    if (action === 'sendReceipt') {
      const order = await db.order.findUnique({
        where: { id: params.id },
        include: {
          customer: true,
          items:    { include: { product: true } },
          payment:  true,
        },
      });
      if (!order) {
        return NextResponse.json({ error: 'Order not found' }, { status: 404 });
      }

      const html = generateReceiptHtml(order);
      await sendMail({
        to:      order.customer.email,
        subject: `Your Receipt for Order #${order.orderNumber}`,
        html,
      });

      return NextResponse.json({ success: true, message: 'Receipt sent successfully' });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Error processing order action:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
