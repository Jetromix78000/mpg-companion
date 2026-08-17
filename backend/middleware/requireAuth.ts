import type { NextFunction, Request, Response } from "express";
import { createSupabaseServerClient, isSupabaseConfigured } from "../supabase";

export interface AuthenticatedUser {
  id: string;
  email: string | null;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      supabase?: ReturnType<typeof createSupabaseServerClient>;
      user?: AuthenticatedUser;
    }
  }
}

/** Refuse la requête si Supabase n'est pas configuré côté serveur. */
export function requireSupabase(_req: Request, res: Response, next: NextFunction) {
  if (!isSupabaseConfigured()) {
    return res
      .status(503)
      .json({ error: "Authentification indisponible : Supabase non configuré" });
  }
  next();
}

/**
 * Valide la session portée par les cookies httpOnly et attache `req.user` + `req.supabase`.
 * getUser() vérifie le JWT auprès de Supabase, contrairement à getSession() qui fait confiance au cookie.
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const supabase = createSupabaseServerClient(req, res);
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) {
    return res.status(401).json({ error: "Connexion requise" });
  }

  req.supabase = supabase;
  req.user = { id: data.user.id, email: data.user.email ?? null };
  next();
}
