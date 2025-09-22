import { Request, Response, NextFunction } from 'express';
import basicAuth from 'basic-auth';

export const basicAuthMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const user = basicAuth(req);

  if (!user || user.name !== process.env.BASIC_AUTH_USER || user.pass !== process.env.BASIC_AUTH_PASS) {
    res.set('WWW-Authenticate', 'Basic realm="Admin Area"');
    return res.status(401).send('Authentication required.');
  }

  next();
};
