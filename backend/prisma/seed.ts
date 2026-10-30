import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  await prisma.processingLog.deleteMany();
  await prisma.invoiceItem.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.user.deleteMany();
  await prisma.company.deleteMany();

  const passwordHash = await bcrypt.hash('password123', 10);

  // Setup Company A (User A)
  const companyA = await prisma.company.create({
    data: {
      name: 'Alpha Corp',
      taxId: 'TAX-ALPHA-01',
      users: {
        create: {
          email: 'userA@alpha.com',
          name: 'User A',
          passwordHash,
        },
      },
    },
  });

  // Setup Company B (User B)
  const companyB = await prisma.company.create({
    data: {
      name: 'Beta Corp',
      taxId: 'TAX-BETA-02',
      users: {
        create: {
          email: 'userB@beta.com',
          name: 'User B',
          passwordHash,
        },
      },
    },
  });

  console.log('Database seeded successfully:');
  console.log(`- Company A ID: ${companyA.id} (userA@alpha.com / password123)`);
  console.log(`- Company B ID: ${companyB.id} (userB@beta.com / password123)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });