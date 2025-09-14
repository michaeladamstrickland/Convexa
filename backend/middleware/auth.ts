import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

// JWT secret key from environment variables
const JWT_SECRET = process.env.JWT_SECRET || 'default-secret-key-for-development';

// Interface for JWT payload
interface JwtPayload {
  userId: string;
  email: string;
  orgId: string;
}

// Extend Express Request interface to include user property
declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

/**
 * Middleware to authenticate JWT token
 */
export const authenticateToken = (req: Request, res: Response, next: NextFunction) => {
  // Skip auth in development mode if flag is set
  if (process.env.SKIP_AUTH === 'true') {
    return next();
  }
  
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized: No token provided' });
  }
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(403).json({ error: 'Forbidden: Invalid token' });
  }
};

/**
 * Middleware to check if user belongs to an organization
 */
export const checkOrgAccess = (req: Request, res: Response, next: NextFunction) => {
  // Skip org check in development mode if flag is set
  if (process.env.SKIP_AUTH === 'true') {
    return next();
  }
  
  // Check if user has an organization ID
  if (!req.user || !req.user.orgId) {
    return res.status(403).json({ error: 'Forbidden: No organization access' });
  }
  
  // Additional org-level permission checks would go here
  
  next();
};
