import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import * as jwt from 'jsonwebtoken';

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      try {
        const decoded = jwt.decode(token) as any;
        if (decoded && decoded.tenantId) {
          // Run the request inside the AsyncLocalStorage context
          return PrismaService.tenantStorage.run(decoded.tenantId, () => {
            // Attach tenantId to request object for easy access
            (req as any).tenantId = decoded.tenantId;
            next();
          });
        }
      } catch (err) {
        // Ignore token decode errors here; JwtAuthGuard will handle unauthorized status
      }
    }

    next();
  }
}
