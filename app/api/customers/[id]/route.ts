import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  try {
    const customer = await db.customer.findUnique({
      where: { id: params.id },
      include: {
        address: true,
        orders: true,
      },
    });

    if (!customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    await db.$transaction(async (tx) => {
      // Optional: delete related orders if your schema supports cascade delete
      await tx.order.deleteMany({
        where: { customerId: customer.id },
      });

      // Optional: delete address if exists
      if (customer.address) {
        await tx.address.delete({
          where: { id: customer.address.id },
        });
      }

      // Finally, delete the customer
      await tx.customer.delete({
        where: { id: customer.id },
      });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting customer:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
