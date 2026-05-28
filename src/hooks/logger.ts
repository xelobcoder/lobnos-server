import winston from 'winston';
import os from 'os';
import path from 'path';
import fs from 'fs';

const logDir = 'logs';
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir);
}

const customFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf((info) => {
    const { timestamp, level, message, service, host, ...meta } = info;
    // Remove internal winston symbols and properties we don't want in the stringified meta
    const cleanMeta = { ...meta };
    delete (cleanMeta as any)[Symbol.for('level')];
    delete (cleanMeta as any)[Symbol.for('message')];
    delete (cleanMeta as any)[Symbol.for('splat')];

    const metaString = Object.keys(cleanMeta).length ? JSON.stringify(cleanMeta) : '';
    return `${timestamp} [${level}] ${message} ${metaString}`;
  })
);

const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  defaultMeta: {
    service: 'lobnos-server',
    host: os.hostname(),
    platform: os.platform(),
    arch: os.arch()
  },
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    // Combined log for everything (info and above)
    new winston.transports.File({
      filename: path.join(logDir, 'combined.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    // Separate log for errors only
    new winston.transports.File({
      filename: path.join(logDir, 'error.log'),
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    // Console output with colors and readable format
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        customFormat
      )
    }),
  ],
});

process.on('uncaughtException', (ex: Error) => {
  logger.error('Uncaught Exception', {
    error: ex.message,
    stack: ex.stack
  });
  // Give time for logger to write to file before exiting
  setTimeout(() => process.exit(1), 1000);
});

process.on('unhandledRejection', (reason: any, promise: Promise<unknown>) => {
  logger.error('Unhandled Rejection', {
    reason: reason?.message || reason,
    stack: reason?.stack
  });
});

export default logger;
