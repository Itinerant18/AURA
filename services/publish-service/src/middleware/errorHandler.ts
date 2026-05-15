import { Request, Response, NextFunction } from 'express';
import { createLogger } from '@aura/utils';

const logger = createLogger('error-handler');

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction) {
  logger.error({ err }, 'Unhandled error');
  return res.status(500).json({
    success: false,
    error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
  });
}
