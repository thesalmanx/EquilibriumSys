import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { db } from '@/lib/db';

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const url = new URL(req.url);
    const category = url.searchParams.get('category');
    const search = url.searchParams.get('search');
    const lowStock = url.searchParams.get('lowStock') === 'true';
    const limit = parseInt(url.searchParams.get('limit') ?? '100', 10);
    const offset = parseInt(url.searchParams.get('offset') ?? '0', 10);

    // Fetch everything first
    let items = await db.inventoryItem.findMany({ orderBy: { updatedAt: 'desc' } });

    // Apply filters in-memory
    if (category) items = items.filter(i => i.category === category);
    if (search) {
      const q = search.toLowerCase();
      items = items.filter(i =>
        i.name.toLowerCase().includes(q) ||
        i.sku.toLowerCase().includes(q) ||
        (i.description?.toLowerCase().includes(q) ?? false)
      );
    }
    if (lowStock) items = items.filter(i => i.quantity <= i.reorderLevel);

    const total = items.length;
    const paginated = items.slice(offset, offset + limit);

    return NextResponse.json({ items: paginated, total, limit, offset });
  } catch (err) {
    console.error('Error fetching inventory:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const data = await req.json();
    if (!data.name || !data.sku) {
      return NextResponse.json({ error: 'Name and SKU are required' }, { status: 400 });
    }
    const exists = await db.inventoryItem.findUnique({ where: { sku: data.sku } });
    if (exists) {
      return NextResponse.json({ error: 'An item with this SKU already exists' }, { status: 400 });
    }
    const item = await db.inventoryItem.create({
      data: {
        ...data,
        quantity: data.quantity ?? 0,
        reorderLevel: data.reorderLevel ?? 0,
        cost: data.cost ?? 0,
        price: data.price ?? 0,
        unit: data.unit ?? 'each',
        createdById: null,
      },
    });
    return NextResponse.json(item);
  } catch (err) {
    console.error('Error creating inventory item:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
