import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { hash } from 'bcrypt';

export async function POST(request: NextRequest) {
  try {
    const { name, email, password } = await request.json();

    if (
      typeof name !== 'string' ||
      typeof email !== 'string' ||
      typeof password !== 'string' ||
      name.length < 2 ||
      password.length < 6
    ) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
    }

    const existing = await db.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: 'Email already in use' }, { status: 409 });
    }

    const hashedPassword = await hash(password, 10);
    const user = await db.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role: 'ADMIN',
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
      },
    });

    return NextResponse.json(user, { status: 201 });
  } catch (err) {
    console.error('Signup error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
