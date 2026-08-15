import type { NextFunction, Request, RequestHandler, Response } from "express";

/**
 * Express 4 n'attrape pas les rejets de Promise : sans ce wrapper, une erreur
 * inattendue dans un handler async laisse la requête pendante jusqu'au timeout.
 */
export const asyncHandler =
  (
    handler: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
  ): RequestHandler =>
  (req, res, next) => {
    handler(req, res, next).catch(next);
  };
