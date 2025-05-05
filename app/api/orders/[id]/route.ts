// app/api/orders/[id]/route.ts
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession }         from 'next-auth/next';
import { authOptions }              from '@/app/api/auth/[...nextauth]/route';
import { db }                       from '@/lib/db';
import { sendMail }                 from '@/lib/mail';
import { generateReceiptHtml }      from '@/lib/receipt-generator';

type Params = { params: { id: string } };

console.log('▶️ /api/orders/[id] handler loaded', {
  NODE_ENV:     process.env.NODE_ENV,
  NEXTAUTH_URL: process.env.NEXTAUTH_URL,
});

export async function GET(request: NextRequest, { params }: Params) {
  console.log(`🔍 GET /api/orders/${params.id}`);
  try {
    const session = await getServerSession(authOptions);
    console.log('   session:', session);
    if (!session) {
      console.error('   ⛔ Unauthorized');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('   fetching order id=', params.id);
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
      console.error('   ⛔ Order not found');
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    console.log('   ✅ returning order:', order.id);
    return NextResponse.json(order);
  } catch (err: any) {
    console.error('   ❌ GET error:', err);
    return NextResponse.json(
      { error: err.message, stack: err.stack },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  console.log(`✏️ PATCH /api/orders/${params.id}`);
  try {
    const session = await getServerSession(authOptions);
    console.log('   session:', session);
    if (!session) {
      console.error('   ⛔ Unauthorized');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.log('   role:', session.user.role);
    if (!['ADMIN', 'STAFF'].includes(session.user.role!)) {
      console.error('   ⛔ Forbidden');
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const data = await request.json();
    console.log('   body:', data);

    const existing = await db.order.findUnique({ where: { id: params.id } });
    if (!existing) {
      console.error('   ⛔ Order not found');
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    if (data.status && data.status !== existing.status) {
      console.log(`   status: ${existing.status} → ${data.status}`);
      await db.orderStatusLog.create({
        data: {
          orderId: existing.id,
          status:  data.status,
          notes:   data.notes || `Status → ${data.status}`,
          userId:  session.user.id,
        },
      });
      if (['DELIVERED', 'COMPLETED'].includes(data.status)) {
        console.log('   marking payment PAID');
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

    console.log('   ✅ PATCH result:', updated.id);
    return NextResponse.json(updated);
  } catch (err: any) {
    console.error('   ❌ PATCH error:', err);
    return NextResponse.json(
      { error: err.message, stack: err.stack },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  console.log(`🗑️ DELETE /api/orders/${params.id}`);
  try {
    const session = await getServerSession(authOptions);
    console.log('   session:', session);
    if (!session) {
      console.error('   ⛔ Unauthorized');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.log('   role:', session.user.role);
    if (session.user.role !== 'ADMIN') {
      console.error('   ⛔ Forbidden');
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const order = await db.order.findUnique({
      where: { id: params.id },
      include: { items: true },
    });
    if (!order) {
      console.error('   ⛔ Order not found');
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }
    if (['DELIVERED', 'COMPLETED'].includes(order.status)) {
      console.error('   ⛔ Cannot delete completed');
      return NextResponse.json(
        { error: 'Cannot delete completed orders' },
        { status: 400 }
      );
    }

    console.log('   deleting & restoring inventory');
    await db.$transaction(async (tx) => {
      for (const it of order.items) {
        console.log('     restore item:', it.productId, it.quantity);
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
              notes:    'Returned from cancel',
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

    console.log('   ✅ DELETE complete');
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('   ❌ DELETE error:', err);
    return NextResponse.json(
      { error: err.message, stack: err.stack },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest, { params }: Params) {
  console.log(`📧 PUT /api/orders/${params.id}`);
  try {
    const session = await getServerSession(authOptions);
    console.log('   session:', session);
    if (!session) {
      console.error('   ⛔ Unauthorized');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { action } = await request.json();
    console.log('   action:', action);
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
        console.error('   ⛔ Order not found');
        return NextResponse.json({ error: 'Order not found' }, { status: 404 });
      }
      const html = generateReceiptHtml(order);
      console.log('   sending receipt to:', order.customer.email);
      await sendMail({
        to:      order.customer.email,
        subject: `Receipt #${order.orderNumber}`,
        html,
      });
      console.log('   ✅ Receipt sent');
      return NextResponse.json({ success: true, message: 'Receipt sent' });
    }

    console.error('   ⛔ Invalid action');
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (err: any) {
    console.error('   ❌ PUT error:', err);
    return NextResponse.json(
      { error: err.message, stack: err.stack },
      { status: 500 }
    );
  }
}
