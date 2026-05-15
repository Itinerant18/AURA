import pino from 'pino';

export const createLogger = (service: string) =>
  pino({
    name: service,
    level: process.env.LOG_LEVEL || 'info',
    transport:
      process.env.NODE_ENV === 'development'
        ? { target: 'pino-pretty', options: { colorize: true } }
        : undefined,
    base: { service },
    timestamp: pino.stdTimeFunctions.isoTime,
  });

export type Logger = ReturnType<typeof createLogger>;
