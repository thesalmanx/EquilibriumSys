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

    let items = await db.inventoryItem.findMany({
      orderBy: { updatedAt: 'desc' },
    });

    // Apply filters in-memory
    if (category) {
      items = items.filter((item) => item.category === category);
    }

    if (search) {
      const lower = search.toLowerCase();
      items = items.filter(
        (item) =>
          item.name.toLowerCase().includes(lower) ||
          item.sku.toLowerCase().includes(lower) ||
          item.description?.toLowerCase().includes(lower)
      );
    }

    if (lowStock) {
      items = items.filter((item) => item.quantity <= item.reorderLevel);
    }

    const total = items.length;
    const paginated = items.slice(offset, offset + limit);

    return NextResponse.json({
      items: paginated,
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
