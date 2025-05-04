import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { db } from '@/lib/db';

export async function GET(req: Request, { params }: { params: { id: string } }) {
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

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Only admins and staff can update inventory items
    if (session.user.role !== 'ADMIN' && session.user.role !== 'STAFF') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    
    const data = await req.json();
    
    // Find current item
    const currentItem = await db.inventoryItem.findUnique({
      where: { id: params.id },
    });
    
    if (!currentItem) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }
    
    // Check if another item has the same SKU if SKU is being changed
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
    
    // Check if quantity has changed
    const quantityChanged = data.quantity !== undefined && data.quantity !== currentItem.quantity;
    const previousQuantity = currentItem.quantity;
    const newQuantity = data.quantity ?? currentItem.quantity;
    
    // Update inventory item
    const item = await db.inventoryItem.update({
      where: { id: params.id },
      data: {
        name: data.name !== undefined ? data.name : undefined,
        sku: data.sku !== undefined ? data.sku : undefined,
        description: data.description !== undefined ? data.description : undefined,
        category: data.category !== undefined ? data.category : undefined,
        quantity: data.quantity !== undefined ? data.quantity : undefined,
        reorderLevel: data.reorderLevel !== undefined ? data.reorderLevel : undefined,
        cost: data.cost !== undefined ? data.cost : undefined,
        price: data.price !== undefined ? data.price : undefined,
        location: data.location !== undefined ? data.location : undefined,
        unit: data.unit !== undefined ? data.unit : undefined,
        updatedAt: new Date(),
      },
    });
    
    // If quantity changed, create inventory history entry
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
      
      // Check if we need to create low stock alert
      const reorderLevel = data.reorderLevel ?? currentItem.reorderLevel;
      if (newQuantity <= reorderLevel && previousQuantity > reorderLevel) {
        await db.notification.create({
          data: {
            type: 'LOW_STOCK',
            title: `Low Stock Alert: ${item.name}`,
            message: `The inventory for ${item.name} (${item.sku}) is below the reorder level.`,
            userId: session.user.id,
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

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Only admins can delete inventory items
    if (session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    
    // Check if item exists
    const item = await db.inventoryItem.findUnique({
      where: { id: params.id },
    });
    
    if (!item) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }
    
    // Delete inventory history related to this item
    await db.inventoryHistory.deleteMany({
      where: { itemId: params.id },
    });
    
    // Delete notifications related to this item
    await db.notification.deleteMany({
      where: {
        metadata: {
          path: ['itemId'],
          equals: params.id
        }
      },
    });
    
    // Delete the item
    await db.inventoryItem.delete({
      where: { id: params.id },
    });
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting inventory item:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}