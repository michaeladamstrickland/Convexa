import type { ZodSchema } from 'zod';
import { z } from 'zod';
import type { Request, Response, NextFunction } from 'express';

export type ProblemError = {
  code: string;
  field?: string;
  message: string;
};

export function validateBody(schema: ZodSchema<any>) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (result.success) {
      // Replace body with parsed (coerced) values
      req.body = result.data as any;
      return next();
    }
    const issues = result.error.issues.map((i) => ({
      code: i.code,
      field: i.path.join('.'),
      message: i.message,
    } satisfies ProblemError));
    res.status(400).type('application/problem+json').json({
      code: 'validation_error',
      message: 'Request body validation failed',
      errors: issues,
    });
  };
}

export function validateQuery(schema: ZodSchema<any>) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.query);
    if (result.success) {
      req.query = result.data as any;
      return next();
    }
    const issues = result.error.issues.map((i) => ({
      code: i.code,
      field: i.path.join('.'),
      message: i.message,
    }));
    res.status(400).type('application/problem+json').json({
      code: 'validation_error',
      message: 'Query validation failed',
      errors: issues,
    });
  };
}
