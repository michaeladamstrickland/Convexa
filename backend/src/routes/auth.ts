import { Router } from 'express';
import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { catchAsync, AppError } from '../middleware/errorHandler';
import { validateSchema, userSchemas } from '../middleware/validation';
import { logger } from '../utils/logger';

const router = Router();
const prisma = new PrismaClient();

const signToken = (id: string) => {
  // Cast to handle jsonwebtoken v9 type overload resolution during test transpilation
  return (jwt as any).sign(
    { id },
    process.env.JWT_SECRET as any,
    {
      expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    } as any
  ) as string;
};

const createSendToken = (user: any, statusCode: number, res: Response) => {
  const token = signToken(user.id);
  
  // Remove password from output
  const { password, ...userWithoutPassword } = user;

  res.status(statusCode).json({
    success: true,
    token,
    data: {
      user: userWithoutPassword,
    },
  });
};

export const register = catchAsync(async (req: Request, res: Response) => {
  const { firstName, lastName, email, password, organizationName } = req.body;

  // Check if user already exists
  const existingUser = await prisma.user.findUnique({
    where: { email },
  });

  if (existingUser) {
    throw new AppError('User with this email already exists', 400);
  }

  // Hash password
  const hashedPassword = await bcrypt.hash(password, 12);

  // Create organization and user in transaction
  const result = await prisma.$transaction(async (tx) => {
    // Create organization
    const organization = await tx.organization.create({
      data: {
        name: organizationName || `${firstName} ${lastName}'s Organization`,
        plan: 'free',
      },
    });

    // Create user
    const user = await tx.user.create({
      data: {
        firstName,
        lastName,
        email,
        password: hashedPassword,
        role: 'admin', // First user is admin
        organizationId: organization.id,
      },
      include: {
        organization: true,
      },
    });

    return user;
  });

  logger.info(`New user registered: ${email}`);
  createSendToken(result, 201, res);
});

export const login = catchAsync(async (req: Request, res: Response) => {
  const { email, password } = req.body;

  // Check if email and password exist
  if (!email || !password) {
    throw new AppError('Please provide email and password!', 400);
  }

  // Check if user exists and password is correct
  const user = await prisma.user.findUnique({
    where: { email },
    include: {
      organization: true,
    },
  });

  if (!user || !user.isActive) {
    throw new AppError('Incorrect email or password', 401);
  }

  const correct = await bcrypt.compare(password, user.password);
  if (!correct) {
    throw new AppError('Incorrect email or password', 401);
  }

  // Update last login
  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  logger.info(`User logged in: ${email}`);
  createSendToken(user, 200, res);
});

export const forgotPassword = catchAsync(async (req: Request, res: Response) => {
  // This is a placeholder - in production you'd send an email
  res.json({
    success: true,
    message: 'Password reset email sent (placeholder)',
  });
});

export const resetPassword = catchAsync(async (req: Request, res: Response) => {
  // This is a placeholder - in production you'd verify the reset token
  res.json({
    success: true,
    message: 'Password reset successful (placeholder)',
  });
});

// Routes
router.post('/register', validateSchema(userSchemas.register), register);
router.post('/login', validateSchema(userSchemas.login), login);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);

export default router;
