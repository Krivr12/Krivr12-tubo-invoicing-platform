import jwt, { type SignOptions } from 'jsonwebtoken';
import { ENV } from './env.js';

export interface TokenPayload {
  userId: string;
  companyId: string;
  email: string;
}

export function generateToken(payload: TokenPayload): string {
  const options: SignOptions = {
    expiresIn: ENV.JWT_EXPIRES_IN as SignOptions['expiresIn'],
  };
  return jwt.sign(payload, ENV.JWT_SECRET, options);
}

export function verifyToken(token: string): TokenPayload {
  return jwt.verify(token, ENV.JWT_SECRET) as TokenPayload;
}