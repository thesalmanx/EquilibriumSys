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
    
    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');
    
    // Verify if the item exists
    const item = await db.inventoryItem.findUnique({
      where: { id: params.id },
    });
    
    if (!item) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }
    
    // Get history entries with user information
    const [history, total] = await Promise.all([
      db.inventoryHistory.findMany({
        where: { itemId: params.id },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      }),
      db.inventoryHistory.count({
        where: { itemId: params.id },
      }),
    ]);
    
    return NextResponse.json({
      history,
      total,
      limit,
      offset,
    });
  } catch (error) {
    console.error('Error fetching inventory history:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}