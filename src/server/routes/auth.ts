import { Router } from "express";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createSupabaseServerClient, getAppOrigin } from "../supabase";
import { requireSupabase } from "../middleware/requireAuth";
import { rateLimit } from "../middleware/rateLimit";
import { asyncHandler } from "../utils/asyncHandler";

// L'envoi de magic link est la seule route qui déclenche un email : 5 essais / 15 min / IP.
const magicLinkRateLimit = rateLimit({ windowMs: 15 * 60 * 1000, max: 5 });

const router = Router();

router.use(requireSupabase);

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// Toutes les redirections pointent vers la racine de l'app : aucun paramètre externe
// n'est réutilisé comme cible, ce qui écarte tout open redirect.
const redirectHome = (res: import("express").Response, params: string) =>
  res.redirect(`/?${params}`);

/** Démarre le flow Google : Supabase génère l'URL OAuth, le code verifier PKCE part en cookie. */
router.get(
  "/google",
  asyncHandler(async (req, res) => {
    const supabase = createSupabaseServerClient(req, res);
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${getAppOrigin(req)}/api/auth/callback` },
    });

    if (error || !data?.url) {
      console.error("Erreur init OAuth Google :", error?.message);
      return redirectHome(res, "auth_error=oauth_init");
    }

    res.redirect(data.url);
  }),
);

/** Retour de Google : échange le code contre une session, posée en cookies httpOnly. */
router.get(
  "/callback",
  asyncHandler(async (req, res) => {
    const code = typeof req.query.code === "string" ? req.query.code : null;

    // Google renvoie ?error=access_denied quand l'utilisateur refuse l'autorisation.
    if (typeof req.query.error === "string") {
      return redirectHome(res, "auth_error=oauth_refused");
    }
    if (!code) {
      return redirectHome(res, "auth_error=missing_code");
    }

    const supabase = createSupabaseServerClient(req, res);
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      console.error("Erreur échange code OAuth :", error.message);
      return redirectHome(res, "auth_error=exchange_failed");
    }

    redirectHome(res, "auth=success");
  }),
);

/** Envoie un magic link à l'adresse fournie. Aucune session n'est créée à cette étape. */
router.post(
  "/magic-link",
  magicLinkRateLimit,
  asyncHandler(async (req, res) => {
    const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";

    if (!EMAIL_REGEX.test(email)) {
      return res.status(400).json({ error: "Adresse email invalide" });
    }

    const supabase = createSupabaseServerClient(req, res);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${getAppOrigin(req)}/api/auth/confirm` },
    });

    if (error) {
      console.error("Erreur envoi magic link :", error.message);

      // Quota du service email (Supabase par défaut est très bas sans SMTP custom configuré).
      if (error.code === "over_email_send_rate_limit") {
        return res.status(429).json({ error: "Trop d'emails envoyés, réessayez plus tard" });
      }
      return res.status(400).json({ error: "Envoi impossible, réessayez dans un instant" });
    }

    res.json({ ok: true });
  }),
);

/** Cible du lien reçu par email : valide le token_hash et pose la session. */
router.get(
  "/confirm",
  asyncHandler(async (req, res) => {
    const tokenHash = typeof req.query.token_hash === "string" ? req.query.token_hash : null;
    const type = (typeof req.query.type === "string" ? req.query.type : "email") as EmailOtpType;

    if (!tokenHash) {
      return redirectHome(res, "auth_error=missing_token");
    }

    const supabase = createSupabaseServerClient(req, res);
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });

    if (error) {
      console.error("Erreur vérification magic link :", error.message);
      return redirectHome(res, "auth_error=link_expired");
    }

    redirectHome(res, "auth=success");
  }),
);

/** État de session pour le client. Répond 200 avec user:null quand personne n'est connecté. */
router.get(
  "/me",
  asyncHandler(async (req, res) => {
    const supabase = createSupabaseServerClient(req, res);
    const { data, error } = await supabase.auth.getUser();

    if (error || !data.user) {
      return res.json({ user: null });
    }

    res.json({ user: { id: data.user.id, email: data.user.email ?? null } });
  }),
);

/** Révoque la session côté Supabase ; @supabase/ssr efface les cookies au passage. */
router.post(
  "/logout",
  asyncHandler(async (req, res) => {
    const supabase = createSupabaseServerClient(req, res);
    await supabase.auth.signOut();
    res.json({ ok: true });
  }),
);

export default router;
