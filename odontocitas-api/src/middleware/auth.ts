import type { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import type { JwtPayload, UserRole } from '../types'
import { getJwtSecret } from '../config/jwt'

export function authenticate(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Token requerido' })
    return
  }

  const token = authHeader.split(' ')[1]
  try {
    const payload = jwt.verify(token, getJwtSecret()) as JwtPayload
    req.user = payload
    next()
  } catch {
    res.status(401).json({ error: 'Token inválido o expirado' })
  }
}

export function authorize(...roles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'No autenticado' })
      return
    }
    if (!roles.includes(req.user.rol)) {
      res.status(403).json({ error: 'Sin permisos para esta acción' })
      return
    }
    next()
  }
}
