import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { hash } from 'bcrypt';

export async function POST(request: NextRequest) {
  try {
    const { name, email, password } = await request.json();

    // basic validation
    if (
      typeof name !== 'string' ||
      typeof email !== 'string' ||
      typeof password !== 'string' ||
      name.length < 2 ||
      password.length < 6
    ) {
      return NextResponse.json(
        { error: 'Invalid name, email, or password.' },
        { status: 400 }
      );
    }

    // check for existing user
    const existing = await db.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json(
        { error: 'Email already in use.' },
        { status: 409 }
      );
    }

    // hash the password
    const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS || '10', 10);
    const hashedPassword = await hash(password, saltRounds);

    // create the new user (default role STAFF—adjust if you have a CUSTOMER/USER enum)
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

    return NextResponse.json({ user }, { status: 201 });
  } catch (err) {
    console.error('🚨 POST /api/signup error:', err);
    return NextResponse.json(
      { error: 'Internal server error.' },
      { status: 500 }
    );
  }
}
