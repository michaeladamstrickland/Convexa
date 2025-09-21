import { describe, it, expect } from 'vitest';
import express from 'express';
import request from 'supertest';
import { z } from 'zod';
import { validateQuery } from '../../../src/middleware/validateBody';

describe('validateQuery middleware', () => {
  it('returns 400 for invalid query', async () => {
    const app = express();
    app.get('/t', validateQuery(z.object({ page: z.coerce.number().int().min(1) })), (_req, res) => res.json({ ok: true }));

    const res = await (request(app) as any).get('/t?page=0');
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('validation_error');
  });

  it('passes for valid query and coerces types', async () => {
    const app = express();
    app.get('/t', validateQuery(z.object({ page: z.coerce.number().int().min(1).default(1) })), (req, res) => res.json({ page: (req.query as any).page }));

    const res = await (request(app) as any).get('/t?page=2');
    expect(res.status).toBe(200);
    expect(res.body.page).toBe(2);
  });
});
