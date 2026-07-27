import { createServerClient } from "@supabase/ssr";
import type { Request, Response } from "express";

// Lecture différée : les imports sont hoistés avant dotenv.config() dans server.ts.
const supabaseUrl = () => process.env.PROJECT_URL_SUPABASE?.trim() ?? "";
const supabaseKey = () => process.env.SUPABASE_KEY?.trim() ?? "";

// Sans configuration Supabase, les routes auth/favoris répondent 503 au lieu de crasher au démarrage.
export const isSupabaseConfigured = () => Boolean(supabaseUrl() && supabaseKey());

/**
 * Client Supabase lié aux cookies de la requête Express.
 * @supabase/ssr lit et écrit lui-même les cookies de session (et le code verifier PKCE) :
 * les tokens restent httpOnly, jamais exposés au JavaScript du navigateur.
 * Le client utilise la clé publishable, donc les policies RLS s'appliquent.
 */
export function createSupabaseServerClient(req: Request, res: Response) {
  return createServerClient(supabaseUrl(), supabaseKey(), {
    cookies: {
      getAll() {
        const cookies = (req.cookies ?? {}) as Record<string, string>;
        return Object.entries(cookies).map(([name, value]) => ({ name, value }));
      },
      setAll(cookiesToSet) {
        for (const { name, value, options } of cookiesToSet) {
          res.cookie(name, value, {
            ...options,
            httpOnly: true,
            // "lax" laisse passer le cookie au retour de redirection OAuth (navigation GET de premier niveau).
            sameSite: "lax",
            secure: process.env.NODE_ENV === "production",
            path: "/",
          });
        }
      },
    },
  });
}

/**
 * Origine publique de l'app, utilisée pour les URLs de redirection OAuth et magic link.
 * APP_URL prime si elle est renseignée ; sinon on la déduit de la requête courante.
 */
export function getAppOrigin(req: Request): string {
  const configured = process.env.APP_URL?.trim();
  if (configured && /^https?:\/\//.test(configured)) {
    return configured.replace(/\/+$/, "");
  }
  return `${req.protocol}://${req.get("host")}`;
}
