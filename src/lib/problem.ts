export type Problem = {
  code: string;
  message: string;
  field?: string;
  status?: number;
};

export function problem(code: string, message: string, field?: string, status = 400): Problem {
  return { code, message, field, status };
}

export function sendProblem(res: any, p: Problem) {
  const { status = 400, ...body } = p;
  res.status(status).json(body);
}

// Minimal Express error handler factory
export function createErrorMiddleware() {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  return function errorHandler(err: any, _req: any, res: any, _next: any) {
    const msg = err?.message || 'Internal server error';
    const status = typeof err?.status === 'number' ? err.status : 500;
    res.status(status).json({ code: 'internal_error', message: msg });
  };
}
