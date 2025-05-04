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
    const category = searchParams.get('category');
    const search = searchParams.get('search');
    const lowStock = searchParams.get('lowStock') === 'true';
    const limit = parseInt(searchParams.get('limit') || '100');
    const offset = parseInt(searchParams.get('offset') || '0');
    
    // Build filters
    const filters: any = {};
    
    if (category) {
      filters.category = category;
    }
    
    if (search) {
      filters.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { sku: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }
    
    if (lowStock) {
      filters.quantity = {
        lte: db.raw('reorderLevel')
      };
    }
    
    // Get inventory items with total count
    const [items, total] = await Promise.all([
      db.inventoryItem.findMany({
        where: filters,
        orderBy: { updatedAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      db.inventoryItem.count({ where: filters }),
    ]);
    
    return NextResponse.json({
      items,
      total,
      limit,
      offset,
    });
  } catch (error) {
    console.error('Error fetching inventory:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Only admins and staff can add inventory items
    if (session.user.role !== 'ADMIN' && session.user.role !== 'STAFF') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    
    const data = await req.json();
    
    // Validate required fields
    if (!data.name || !data.sku) {
      return NextResponse.json(
        { error: 'Name and SKU are required' },
        { status: 400 }
      );
    }
    
    // Check if SKU is unique
    const existingItem = await db.inventoryItem.findUnique({
      where: { sku: data.sku },
    });
    
    if (existingItem) {
      return NextResponse.json(
        { error: 'An item with this SKU already exists' },
        { status: 400 }
      );
    }
    
    // Create inventory item
    const item = await db.inventoryItem.create({
      data: {
        name: data.name,
        sku: data.sku,
        description: data.description,
        category: data.category,
        quantity: data.quantity || 0,
        reorderLevel: data.reorderLevel || 0,
        cost: data.cost || 0,
        price: data.price || 0,
        location: data.location,
        unit: data.unit || 'each',
        // Track who created this item
        createdBy: {
          connect: { id: session.user.id }
        }
      },
    });
    
    // Create inventory history entry
    await db.inventoryHistory.create({
      data: {
        itemId: item.id,
        action: 'CREATE',
        quantity: data.quantity || 0,
        notes: 'Initial inventory created',
        userId: session.user.id,
      },
    });
    
    // Check if we need to create low stock alert
    if ((data.quantity || 0) <= (data.reorderLevel || 0)) {
      await db.notification.create({
        data: {
          type: 'LOW_STOCK',
          title: `Low Stock Alert: ${data.name}`,
          message: `The inventory for ${data.name} (${data.sku}) is below the reorder level.`,
          userId: session.user.id,
          metadata: {
            itemId: item.id,
            sku: data.sku,
            quantity: data.quantity || 0,
            reorderLevel: data.reorderLevel || 0,
          },
        },
      });
    }
    
    return NextResponse.json(item);
  } catch (error) {
    console.error('Error creating inventory item:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}