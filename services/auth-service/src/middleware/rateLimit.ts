import { Request, Response, NextFunction } from 'express';

const windowMs = 60 * 1000;
const maxRequests = 100;
const requests = new Map<string, { count: number; resetTime: number }>();

export function rateLimit(req: Request, res: Response, next: NextFunction) {
  const key = req.ip || 'unknown';
  const now = Date.now();
  const record = requests.get(key);

  if (!record || now > record.resetTime) {
    requests.set(key, { count: 1, resetTime: now + windowMs });
    return next();
  }

  if (record.count >= maxRequests) {
    return res.status(429).json({
      success: false,
      error: { code: 'RATE_LIMITED', message: 'Too many requests. Please try again later.' },
    });
  }

  record.count++;
  next();
}
