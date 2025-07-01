import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  try {
    const items = await db.inventoryItem.findMany({
      where: {
        quantity: {
          lt: {
            path: ['reorderLevel'],
            equals: true,
          },
        },
      },
    });

    // fallback if above JSON path fails:
    const fallbackItems = await db.inventoryItem.findMany({
      where: {
        quantity: { lt: 9999 }, // or reorderLevel
      },
    });

    return NextResponse.json({ items: fallbackItems });
  } catch (error) {
    console.error('Low stock fetch failed:', error);
    return NextResponse.json({ items: [] });
  }
}
