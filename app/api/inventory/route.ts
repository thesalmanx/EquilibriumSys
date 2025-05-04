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
    const data = await req.json();

    if (!data.name || !data.sku) {
      return NextResponse.json({ error: 'Name and SKU are required' }, { status: 400 });
    }

    const existingItem = await db.inventoryItem.findUnique({ where: { sku: data.sku } });

    if (existingItem) {
      return NextResponse.json({ error: 'An item with this SKU already exists' }, { status: 400 });
    }

    const item = await db.inventoryItem.create({
      data: {
        ...data,
        quantity: data.quantity || 0,
        reorderLevel: data.reorderLevel || 0,
        cost: data.cost || 0,
        price: data.price || 0,
        unit: data.unit || 'each',
        createdById: null, // optional
      },
    });

    return NextResponse.json(item);
  } catch (error) {
    console.error('Error creating inventory item:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
