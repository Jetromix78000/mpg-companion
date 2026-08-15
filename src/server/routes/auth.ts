import { Router } from "express";
import { createSupabaseServerClient, getAppOrigin } from "../supabase";
import { requireAuth, requireSupabase } from "../middleware/requireAuth";
import { rateLimit } from "../middleware/rateLimit";
import { asyncHandler } from "../utils/asyncHandler";

// Protège du bourrinage de mots de passe et du spam de création de comptes.
const passwordAuthRateLimit = rateLimit({ windowMs: 15 * 60 * 1000, max: 10 });

const MIN_PASSWORD_LENGTH = 8;

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

/** Connexion email + mot de passe. La session part en cookies httpOnly, sans quitter la page. */
router.post(
  "/login",
  passwordAuthRateLimit,
  asyncHandler(async (req, res) => {
    const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
    const password = typeof req.body?.password === "string" ? req.body.password : "";

    if (!EMAIL_REGEX.test(email) || !password) {
      return res.status(400).json({ error: "Email ou mot de passe manquant" });
    }

    const supabase = createSupabaseServerClient(req, res);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    // Message volontairement générique : ne jamais révéler si l'email existe (énumération de comptes).
    if (error || !data.user) {
      return res.status(401).json({ error: "Email ou mot de passe incorrect" });
    }

    res.json({ user: { id: data.user.id, email: data.user.email ?? null } });
  }),
);

/** Création de compte. Ouvre la session directement quand "Confirm email" est désactivé côté Supabase. */
router.post(
  "/signup",
  passwordAuthRateLimit,
  asyncHandler(async (req, res) => {
    const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
    const password = typeof req.body?.password === "string" ? req.body.password : "";

    if (!EMAIL_REGEX.test(email)) {
      return res.status(400).json({ error: "Adresse email invalide" });
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      return res
        .status(400)
        .json({ error: `Mot de passe trop court (${MIN_PASSWORD_LENGTH} caractères minimum)` });
    }

    const supabase = createSupabaseServerClient(req, res);
    const { data, error } = await supabase.auth.signUp({ email, password });

    if (error) {
      console.error("Erreur création de compte :", error.message);

      if (error.code === "user_already_exists") {
        return res.status(409).json({ error: "Un compte existe déjà avec cet email" });
      }
      if (error.code === "weak_password") {
        return res
          .status(400)
          .json({ error: `Mot de passe trop faible (${MIN_PASSWORD_LENGTH} caractères minimum)` });
      }
      // Quota du service email, atteignable seulement si "Confirm email" est resté activé.
      if (error.code === "over_email_send_rate_limit") {
        return res.status(429).json({ error: "Trop d'emails envoyés, réessayez plus tard" });
      }
      return res.status(400).json({ error: "Création impossible, réessayez dans un instant" });
    }

    // Sans session, c'est que "Confirm email" est activé : le compte attend une validation par email.
    if (!data.session || !data.user) {
      return res.json({ user: null, confirmationRequired: true });
    }

    res.json({ user: { id: data.user.id, email: data.user.email ?? null } });
  }),
);

/**
 * Envoie un email de réinitialisation. Répond toujours 200 même si l'adresse est inconnue :
 * une réponse différenciée permettrait d'énumérer les comptes existants.
 */
router.post(
  "/reset-password",
  passwordAuthRateLimit,
  asyncHandler(async (req, res) => {
    const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";

    if (!EMAIL_REGEX.test(email)) {
      return res.status(400).json({ error: "Adresse email invalide" });
    }

    const supabase = createSupabaseServerClient(req, res);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${getAppOrigin(req)}/api/auth/recovery`,
    });

    if (error) {
      console.error("Erreur envoi email de réinitialisation :", error.message);

      // Quota du service email (Supabase par défaut est très bas sans SMTP custom configuré).
      if (error.code === "over_email_send_rate_limit") {
        return res.status(429).json({ error: "Trop d'emails envoyés, réessayez plus tard" });
      }
    }

    res.json({ ok: true });
  }),
);

/** Cible du lien de réinitialisation : ouvre une session pour permettre le changement de mot de passe. */
router.get(
  "/recovery",
  asyncHandler(async (req, res) => {
    const code = typeof req.query.code === "string" ? req.query.code : null;

    if (!code) {
      return redirectHome(res, "auth_error=missing_code");
    }

    const supabase = createSupabaseServerClient(req, res);
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      console.error("Erreur échange code de réinitialisation :", error.message);
      return redirectHome(res, "auth_error=link_expired");
    }

    redirectHome(res, "auth=recovery");
  }),
);

/** Définit un nouveau mot de passe pour la session en cours (classique ou issue d'un lien de reset). */
router.post(
  "/password",
  passwordAuthRateLimit,
  requireAuth,
  asyncHandler(async (req, res) => {
    const password = typeof req.body?.password === "string" ? req.body.password : "";

    if (password.length < MIN_PASSWORD_LENGTH) {
      return res
        .status(400)
        .json({ error: `Mot de passe trop court (${MIN_PASSWORD_LENGTH} caractères minimum)` });
    }

    const { error } = await req.supabase!.auth.updateUser({ password });

    if (error) {
      console.error("Erreur changement de mot de passe :", error.message);
      return res.status(400).json({ error: "Changement impossible, réessayez dans un instant" });
    }

    res.json({ ok: true });
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
