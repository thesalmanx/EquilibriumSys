// app/api/orders/[id]/route.ts
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession }           from 'next-auth/next';
import { authOptions }                from '@/app/api/auth/[...nextauth]/route';
import { db }                         from '@/lib/db';
import { sendMail }                   from '@/lib/mail';
import { generateReceiptHtml }        from '@/lib/receipt-generator';

type Params = { params: { id: string } };

console.log('▶️ /api/orders/[id] handler loaded', {
  NODE_ENV:    process.env.NODE_ENV,
  NEXTAUTH_URL: process.env.NEXTAUTH_URL,
});

export async function GET(request: NextRequest, { params }: Params) {
  console.log(`🔍 GET /api/orders/${params.id} called`);
  try {
    const session = await getServerSession(authOptions);
    console.log('   session:', session);
    if (!session) {
      console.error('   ⛔ GET Unauthorized – no session');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('   fetching order id=', params.id);
    const order = await db.order.findUnique({
      where: { id: params.id },
      include: {
        customer: { include: { address: true } },
        items:    { include: { product: true } },
        payment:  true,
        statusHistory: {
          include: { user: { select: { id: true, name: true, email: true } } },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!order) {
      console.error('   ⛔ GET Order not found:', params.id);
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    console.log('   ✅ GET returning order:', order.id);
    return NextResponse.json(order);
  } catch (err) {
    console.error('   ❌ GET error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  console.log(`✏️ PATCH /api/orders/${params.id} called`);
  try {
    const session = await getServerSession(authOptions);
    console.log('   session:', session);
    if (!session) {
      console.error('   ⛔ PATCH Unauthorized – no session');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.log('   session.user.role =', session.user.role);
    if (!['ADMIN', 'STAFF'].includes(session.user.role!)) {
      console.error('   ⛔ PATCH Forbidden – role=', session.user.role);
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const data = await request.json();
    console.log('   request.body:', data);

    console.log('   loading existing order:', params.id);
    const existing = await db.order.findUnique({ where: { id: params.id } });
    if (!existing) {
      console.error('   ⛔ PATCH Order not found:', params.id);
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    // Status change
    if (data.status && data.status !== existing.status) {
      console.log(`   status change: ${existing.status} → ${data.status}`);
      await db.orderStatusLog.create({
        data: {
          orderId: existing.id,
          status:  data.status,
          notes:   data.notes || `Status updated to ${data.status}`,
          userId:  session.user.id,
        },
      });
      if (['DELIVERED', 'COMPLETED'].includes(data.status)) {
        console.log('   marking payment as PAID for order:', existing.id);
        await db.payment.updateMany({
          where: { orderId: existing.id },
          data:  { status: 'PAID', date: new Date() },
        });
      }
    }

    console.log('   updating order record:', params.id);
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

    console.log('   ✅ PATCH updated order:', updated.id);
    return NextResponse.json(updated);
  } catch (err) {
    console.error('   ❌ PATCH error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  console.log(`🗑️ DELETE /api/orders/${params.id} called`);
  try {
    const session = await getServerSession(authOptions);
    console.log('   session:', session);
    if (!session) {
      console.error('   ⛔ DELETE Unauthorized – no session');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.log('   session.user.role =', session.user.role);
    if (session.user.role !== 'ADMIN') {
      console.error('   ⛔ DELETE Forbidden – role=', session.user.role);
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    console.log('   fetching order for deletion:', params.id);
    const order = await db.order.findUnique({
      where: { id: params.id },
      include: { items: true },
    });
    if (!order) {
      console.error('   ⛔ DELETE Order not found:', params.id);
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }
    console.log('   order.status =', order.status);
    if (['DELIVERED', 'COMPLETED'].includes(order.status)) {
      console.error('   ⛔ DELETE Cannot delete completed order:', order.status);
      return NextResponse.json({ error: 'Cannot delete completed orders' }, { status: 400 });
    }

    console.log('   restoring inventory and deleting order transactionally');
    await db.$transaction(async (tx) => {
      for (const item of order.items) {
        console.log('     restoring item:', item.productId, 'qty', item.quantity);
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
              notes:    'Returned due to order cancellation',
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

    console.log('   ✅ DELETE completed for order:', params.id);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('   ❌ DELETE error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: Params) {
  console.log(`📧 PUT /api/orders/${params.id} called`);
  try {
    const session = await getServerSession(authOptions);
    console.log('   session:', session);
    if (!session) {
      console.error('   ⛔ PUT Unauthorized – no session');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { action } = await request.json();
    console.log('   action:', action);
    if (action === 'sendReceipt') {
      console.log('   generating receipt for order:', params.id);
      const order = await db.order.findUnique({
        where: { id: params.id },
        include: {
          customer: true,
          items:    { include: { product: true } },
          payment:  true,
        },
      });
      if (!order) {
        console.error('   ⛔ PUT Order not found:', params.id);
        return NextResponse.json({ error: 'Order not found' }, { status: 404 });
      }

      const html = generateReceiptHtml(order);
      console.log('   sending email to:', order.customer.email);
      await sendMail({
        to:      order.customer.email,
        subject: `Your Receipt for Order #${order.orderNumber}`,
        html,
      });

      console.log('   ✅ Receipt sent');
      return NextResponse.json({ success: true, message: 'Receipt sent successfully' });
    }

    console.error('   ⛔ PUT Invalid action:', action);
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (err) {
    console.error('   ❌ PUT error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
