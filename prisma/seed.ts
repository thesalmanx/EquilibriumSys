import { PrismaClient } from '@prisma/client';
import { hash } from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS || '10');
  const adminPassword = await hash('password123', saltRounds);
  const staffPassword = await hash('password123', saltRounds);

  await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: {},
    create: {
      email: 'admin@example.com',
      name: 'Admin User',
      password: adminPassword,
      role: 'ADMIN',
    },
  });

  await prisma.user.upsert({
    
    where: { email: 'staff@example.com' },
    update: {},
    create: {
      email: 'staff@example.com',
      name: 'Staff User',
      password: staffPassword,
      role: 'STAFF',
    },
  });

  console.log('Seed complete. Users created.');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
