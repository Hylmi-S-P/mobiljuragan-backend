import type { Request, Response, NextFunction } from 'express';
import type { ZodTypeAny } from 'zod';

export function validateBody(schema: ZodTypeAny) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      req.body = await schema.parseAsync(req.body);
      next();
    } catch (error) {
      next(error);
    }
  };
}

export function validateQuery(schema: ZodTypeAny) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      // Zod 4 mengembalikan `unknown` untuk skema bertipe ZodTypeAny, jadi hasil
      // parse dikembalikan ke tipe asli properti Express-nya secara eksplisit.
      req.query = (await schema.parseAsync(req.query)) as typeof req.query;
      next();
    } catch (error) {
      next(error);
    }
  };
}

export function validateParams(schema: ZodTypeAny) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      req.params = (await schema.parseAsync(req.params)) as typeof req.params;
      next();
    } catch (error) {
      next(error);
    }
  };
}
