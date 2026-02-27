import { Request, Response, NextFunction } from "express";

/**
 * Logs every incoming request with method, path, status code,
 * and how long it took to respond. Helps with debugging and
 * gives visibility into what the API is doing.
 */
export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();

  res.on("finish", () => {
    const duration = Date.now() - start;
    const status = res.statusCode;

    const statusColor =
      status >= 500 ? "\x1b[31m" :
      status >= 400 ? "\x1b[33m" :
      "\x1b[32m";

    const reset = "\x1b[0m";

    console.log(
      `${req.method} ${req.path} → ${statusColor}${status}${reset} (${duration}ms)`
    );
  });

  next();
}