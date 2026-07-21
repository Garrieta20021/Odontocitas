import type { Request, Response, NextFunction } from 'express'

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
): void {
  console.error(`[ERROR] ${req.method} ${req.path}:`, err.message)

  if (err.name === 'ValidationError') {
    res.status(400).json({ error: err.message })
    return
  }

  res.status(500).json({
    error: process.env.NODE_ENV === 'production'
      ? 'Error interno del servidor'
      : err.message
  })
}
