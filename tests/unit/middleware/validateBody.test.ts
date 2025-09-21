import { describe, it, expect } from 'vitest';
import express from 'express';
import request from 'supertest';
import { z } from 'zod';
import { validateBody } from '../../../src/middleware/validateBody';

describe('validateBody middleware', () => {
  it('produces 400 on invalid body', async () => {
    const app = express();
    app.use(express.json());
    app.post('/t', validateBody(z.object({ a: z.string() })), (_req, res) => res.json({ ok: true }));

    const res = await request(app).post('/t').send({ a: 1 });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('validation_error');
  });

  it('passes on valid body', async () => {
    const app = express();
    app.use(express.json());
    app.post('/t', validateBody(z.object({ a: z.string() })), (_req, res) => res.json({ ok: true }));

    const res = await request(app).post('/t').send({ a: 'hi' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });
});
