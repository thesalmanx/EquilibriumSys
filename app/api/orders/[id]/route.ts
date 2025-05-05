// app/api/orders/[id]/route.ts
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { db }                       from '@/lib/db';
import { sendMail }                 from '@/lib/mail';
import { generateReceiptHtml }      from '@/lib/receipt-generator';

const ADMIN_USER_ID = '6c429b14-3bf3-4371-b32d-006c26897189';

type Params = { params: { id: string } };

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const order = await db.order.findUnique({
      where: { id: params.id },
      include: {
        customer:      { include: { address: true } },
        items:         { include: { product: true } },
        payment:       true,
        statusHistory: {
          include: { user: { select: { id: true, name: true, email: true } } },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }
    return NextResponse.json(order);
  } catch (err: any) {
    console.error('GET /api/orders/[id] error:', err);
    return NextResponse.json(
      { error: err.message, stack: err.stack },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const data = await request.json();

    const existing = await db.order.findUnique({ where: { id: params.id } });
    if (!existing) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    // If status is changing, log it
    if (data.status && data.status !== existing.status) {
      await db.orderStatusLog.create({
        data: {
          orderId: existing.id,
          status:  data.status,
          notes:   data.notes ?? `Status updated to ${data.status}`,
          userId:  ADMIN_USER_ID,
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
        notes:     data.notes   ?? undefined,
        status:    data.status  ?? undefined,
        updatedAt: new Date(),
      },
      include: {
        customer: true,
        items:    { include: { product: true } },
        payment:  true,
      },
    });

    return NextResponse.json(updated);
  } catch (err: any) {
    console.error('PATCH /api/orders/[id] error:', err);
    return NextResponse.json(
      { error: err.message, stack: err.stack },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  try {
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

    await db.$transaction(async (tx) => {
      for (const it of order.items) {
        const prod = await tx.inventoryItem.findUnique({ where: { id: it.productId } });
        if (prod) {
          await tx.inventoryItem.update({
            where: { id: prod.id },
            data:  { quantity: prod.quantity + it.quantity },
          });
          await tx.inventoryHistory.create({
            data: {
              itemId:   prod.id,
              action:   'ADD',
              quantity: it.quantity,
              notes:    'Returned due to order cancellation',
              userId:   ADMIN_USER_ID,
            },
          });
        }
      }

      await tx.orderStatusLog.deleteMany({ where: { orderId: order.id } });
      await tx.orderItem.deleteMany({ where: { orderId: order.id } });
      await tx.payment.deleteMany({ where: { orderId: order.id } });
      await tx.order.delete({ where: { id: order.id } });
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('DELETE /api/orders/[id] error:', err);
    return NextResponse.json(
      { error: err.message, stack: err.stack },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest, { params }: Params) {
  try {
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
  } catch (err: any) {
    console.error('PUT /api/orders/[id] error:', err);
    return NextResponse.json(
      { error: err.message, stack: err.stack },
      { status: 500 }
    );
  }
}
