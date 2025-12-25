import { Request, Response, NextFunction } from 'express';

const requestLogger = (req: Request, res: Response, next: NextFunction) => {
     const start = Date.now();
     const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 19);

     res.on('finish', () => {
          const duration = Date.now() - start;
          console.log(`[${timestamp}] ${req.method} ${req.originalUrl} ${res.statusCode} - ${duration}ms`);
     });

     next();
};

export default requestLogger;