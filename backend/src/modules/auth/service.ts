import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import { generateToken } from '../../config/jwt.js';

const prisma = new PrismaClient();

export async function loginUser(email: string, passwordPlain: string) {
  const user = await prisma.user.findUnique({
    where: { email },
    include: { company: true },
  });

  if (!user) {
    return null;
  }

  const isMatch = await bcrypt.compare(passwordPlain, user.passwordHash);
  if (!isMatch) {
    return null;
  }

  const token = generateToken({
    userId: user.id,
    companyId: user.companyId,
    email: user.email,
  });

  return {
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      company: {
        id: user.company.id,
        name: user.company.name,
      },
    },
  };
}