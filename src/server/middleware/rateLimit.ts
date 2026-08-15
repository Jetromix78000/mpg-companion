import type { NextFunction, Request, Response } from "express";

interface Bucket {
  count: number;
  resetAt: number;
}

const MAX_TRACKED_KEYS = 5000;

/**
 * Limiteur en mémoire pour les routes d'auth : il complète le rate limiting de
 * Supabase et coupe court au bourrinage de mots de passe depuis une même IP.
 * Portée d'un seul processus : à remplacer par un store partagé le jour où l'app
 * tourne sur plusieurs instances.
 */
export function rateLimit({ windowMs, max }: { windowMs: number; max: number }) {
  const buckets = new Map<string, Bucket>();

  return (req: Request, res: Response, next: NextFunction) => {
    const key = req.ip ?? "unknown";
    const now = Date.now();

    // Purge les compteurs expirés pour que la Map ne grossisse pas indéfiniment.
    if (buckets.size > MAX_TRACKED_KEYS) {
      for (const [trackedKey, tracked] of buckets) {
        if (now > tracked.resetAt) buckets.delete(trackedKey);
      }
    }

    const bucket = buckets.get(key);

    if (!bucket || now > bucket.resetAt) {
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    if (bucket.count >= max) {
      const retryAfter = Math.ceil((bucket.resetAt - now) / 1000);
      res.setHeader("Retry-After", String(retryAfter));
      return res.status(429).json({ error: "Trop de tentatives, réessayez dans un instant" });
    }

    bucket.count += 1;
    next();
  };
}
