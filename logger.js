// logger.js — Логирование (аналог logger.py)
import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  redact: {
    paths: [
      'err.config.headers.Authorization',
      'err.config.headers["Authorization"]',
      'err.response.config.headers.Authorization',
      'err.response.config.headers["Authorization"]',
      'err.request._header',
      'err.request._redirectable._options.headers.Authorization',
      'err.response.request._header',
      'err.response.request._redirectable._options.headers.Authorization',
    ],
    censor: '[REDACTED]',
  },
  transport: process.env.NODE_ENV !== 'production'
    ? { target: 'pino/file', options: { destination: 1 } }
    : undefined,
});
