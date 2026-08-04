import { Request, Response, NextFunction } from "express";

const requestLogger = (
     req: Request,
     res: Response,
     next: NextFunction
) => {
     const start = process.hrtime.bigint();
     const pid = process.pid;

     const timestamp = new Date().toLocaleString("en-US", {
          month: "2-digit",
          day: "2-digit",
          year: "numeric",
          hour: "numeric",
          minute: "2-digit",
          second: "2-digit",
          hour12: true,
     });

     console.log(
          `\x1b[32m[PrimeLabSys]\x1b[0m ${pid}  - ${timestamp}     \x1b[32mLOG\x1b[0m \x1b[38;5;39m[HTTP]\x1b[0m ${req.method} ${req.originalUrl}`
     );

     
     res.on("finish", () => {
          const duration =
               Number(process.hrtime.bigint() - start) / 1_000_000;

          const color =
               res.statusCode >= 500
                    ? "\x1b[31m"
                    : res.statusCode >= 400
                         ? "\x1b[33m"
                         : "\x1b[32m";

          console.log(
               `\x1b[32m[PrimeLabSys]\x1b[0m ${pid}  - ${timestamp}     ${color}LOG\x1b[0m \x1b[38;5;39m[HTTP]\x1b[0m ${res.statusCode} ${res.statusMessage} +${duration.toFixed(
                    2
               )}ms`
          );
     });

     next();
};

export default requestLogger;