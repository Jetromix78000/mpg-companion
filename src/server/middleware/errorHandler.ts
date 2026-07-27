import type { NextFunction, Request, Response } from "express";

/**
 * Filet de sécurité en fin de chaîne : renvoie du JSON aux appels /api et laisse
 * le message technique côté logs, jamais côté client.
 */
export function apiErrorHandler(err: unknown, req: Request, res: Response, next: NextFunction) {
  if (res.headersSent) {
    return next(err);
  }

  const message = err instanceof Error ? err.message : String(err);
  console.error(`Erreur non gérée sur ${req.method} ${req.originalUrl} :`, message);

  res.status(500).json({ error: "Erreur serveur" });
}
