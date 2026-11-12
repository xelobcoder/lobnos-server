import { NextFunction, Request, Response } from "express";

interface Bucket {
     count: number;
     resetAt: number;
}

/**
 * Small fixed-window limiter for unauthenticated portal endpoints. State is per process, which is
 * sufficient for the single-node PLS deployments; it bounds brute-force attempts on codes and tokens.
 */
export function createRateLimiter(options: { windowMs: number; max: number; key?: (req: Request) => string }) {
     const buckets = new Map<string, Bucket>();
     let lastSweep = Date.now();

     const limiter = (req: Request, res: Response, next: NextFunction) => {
          const now = Date.now();
          if (now - lastSweep > options.windowMs) {
               for (const [key, bucket] of buckets) if (bucket.resetAt <= now) buckets.delete(key);
               lastSweep = now;
          }
          const key = `${req.path}|${options.key ? options.key(req) : req.ip || req.socket?.remoteAddress || "unknown"}`;
          const bucket = buckets.get(key);
          if (!bucket || bucket.resetAt <= now) {
               buckets.set(key, { count: 1, resetAt: now + options.windowMs });
               return next();
          }
          bucket.count += 1;
          if (bucket.count > options.max) {
               res.setHeader("Retry-After", Math.ceil((bucket.resetAt - now) / 1000).toString());
               return res.status(429).json({
                    status: "error",
                    statusCode: 429,
                    code: "RATE_LIMITED",
                    message: "Too many attempts. Please wait a few minutes and try again.",
               });
          }
          return next();
     };
     limiter.reset = () => buckets.clear();
     return limiter;
}
