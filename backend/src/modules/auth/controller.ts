import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import * as authService from './service.js';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function login(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { email, password } = loginSchema.parse(req.body);
    const result = await authService.loginUser(email, password);

    if (!result) {
      res.status(401).json({ message: 'Invalid email or password' });
      return;
    }

    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}
