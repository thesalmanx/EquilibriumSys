import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { db } from '@/lib/db';

// Helper to get an admin user ID for logging
async function getAdminUserId() {
  const admin = await db.user.findFirst({ where: { role: 'ADMIN' } });
  if (!admin) throw new Error('Admin user not found');
  return admin.id;
}

type Params = { params: { id: string } };

export async function GET(req: Request, { params }: Params) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const item = await db.inventoryItem.findUnique({
      where: { id: params.id },
    });

    if (!item) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }

    return NextResponse.json(item);
  } catch (error) {
    console.error('Error fetching inventory item:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function PUT(req: Request, { params }: Params) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (session.user.role !== 'ADMIN' && session.user.role !== 'STAFF') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const data = await req.json();

    const currentItem = await db.inventoryItem.findUnique({
      where: { id: params.id },
    });

    if (!currentItem) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }

    if (data.sku && data.sku !== currentItem.sku) {
      const existingItem = await db.inventoryItem.findUnique({
        where: { sku: data.sku },
      });

      if (existingItem && existingItem.id !== params.id) {
        return NextResponse.json(
          { error: 'An item with this SKU already exists' },
          { status: 400 }
        );
      }
    }

    const quantityChanged = data.quantity !== undefined && data.quantity !== currentItem.quantity;
    const previousQuantity = currentItem.quantity;
    const newQuantity = data.quantity ?? currentItem.quantity;

    const item = await db.inventoryItem.update({
      where: { id: params.id },
      data: {
        name: data.name ?? undefined,
        sku: data.sku ?? undefined,
        description: data.description ?? undefined,
        category: data.category ?? undefined,
        quantity: data.quantity ?? undefined,
        reorderLevel: data.reorderLevel ?? undefined,
        cost: data.cost ?? undefined,
        price: data.price ?? undefined,
        location: data.location ?? undefined,
        unit: data.unit ?? undefined,
        updatedAt: new Date(),
      },
    });

    if (quantityChanged) {
      const quantityDifference = newQuantity - previousQuantity;
      const action = quantityDifference > 0 ? 'ADD' : 'REMOVE';

      await db.inventoryHistory.create({
        data: {
          itemId: item.id,
          action,
          quantity: Math.abs(quantityDifference),
          notes: data.notes || `Manual ${action.toLowerCase()} by ${session.user.name || session.user.email}`,
          userId: session.user.id,
        },
      });

      const reorderLevel = data.reorderLevel ?? currentItem.reorderLevel;
      if (newQuantity <= reorderLevel && previousQuantity > reorderLevel) {
await db.notification.create({
  data: {
    type: 'LOW_STOCK',
    title: `Low Stock Alert: ${item.name}`,
    message: `The inventory for ${item.name} (${item.sku}) is below the reorder level.`,
    userId: session.user.id,
    read: false,
    readAt: null,
    metadata: {
      itemId: item.id,
      sku: item.sku,
      quantity: newQuantity,
      reorderLevel,
    },
  },
});


      }
    }

    return NextResponse.json(item);
  } catch (error) {
    console.error('Error updating inventory item:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const adminUserId = await getAdminUserId();

    const item = await db.inventoryItem.findUnique({
      where: { id: params.id },
    });

    if (!item) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }

    await db.$transaction(async (tx) => {
      // Log the deletion
      await tx.inventoryHistory.create({
        data: {
          itemId: item.id,
          action: 'REMOVE',
          quantity: item.quantity,
          notes: 'Item deleted by admin',
          userId: adminUserId,
        },
      });

      // Delete related notifications
      await tx.notification.deleteMany({
        where: {
          metadata: {
            path: ['itemId'],
            equals: params.id,
          },
        },
      });

      // Delete history entries
      await tx.inventoryHistory.deleteMany({
        where: { itemId: params.id },
      });

      // Delete the item
      await tx.inventoryItem.delete({
        where: { id: params.id },
      });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting inventory item:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
