export type UserRole = 'admin' | 'odontologo' | 'paciente'

export interface JwtPayload {
  userId: string
  cedula: string
  rol: UserRole
  nombre: string
}

export interface AuthRequest extends Express.Request {
  user?: JwtPayload
}

// Re-export express types
import type { Request, Response, NextFunction } from 'express'
export type { Request, Response, NextFunction }

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload
    }
  }
}
