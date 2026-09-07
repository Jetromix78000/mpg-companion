import type { NextFunction, Request, Response } from "express";
import { Router } from "express";
// bcryptjs plutôt que bcrypt : ce dernier est un module natif, et ses bindings
// compilés ne survivent pas au bundle de la fonction serverless Vercel — le
// require échouait au chargement de app.ts, faisant tomber *toutes* les routes,
// y compris celles qui ne servent que du mock. Même algorithme, hashes
// compatibles, API identique.
import bcrypt from "bcryptjs";
import uid2 from "uid2";
import type { UserDocument } from "../models/User.js";
import { User } from "../models/User.js";

/**
 * L'utilisateur s'inscrit, se connecte ou se déconnecte via ce fichier.
 * Son mot de passe est vérifié et son token de session est géré.
 */

const MIN_PASSWORD_LENGTH = 8;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// Longueur du token de session, en octets aléatoires.
const TOKEN_LENGTH = 32;

// 12 tours : quelques centaines de millisecondes par vérification, assez lent pour
// décourager une attaque hors ligne sur un dump de la base.
const BCRYPT_ROUNDS = 12;

function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

function verifyPassword(plain: string, passwordHash: string): Promise<boolean> {
  return bcrypt.compare(plain, passwordHash);
}

export interface AuthenticatedUser {
  id: string;
  email: string;
  displayName: string | null;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

/**
 * L'utilisateur envoie son token dans l'en-tête Authorization.
 * Son compte est retrouvé, ou null s'il n'est plus valide.
 */
async function resolveUser(req: Request): Promise<AuthenticatedUser | null> {
  const [scheme, token] = (req.headers.authorization ?? "").split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) return null;

  const user = await User.findOne({ token });
  if (!user) return null;

  return { id: String(user._id), email: user.email, displayName: user.displayName ?? null };
}

/**
 * L'utilisateur appelle une route protégée sans être connecté.
 * La requête est refusée avec un 401.
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const user = await resolveUser(req);

  if (!user) {
    return res.status(401).json({ error: "Connexion requise" });
  }

  req.user = user;
  next();
}

/**
 * L'utilisateur visite /api/auth/session, connecté ou non.
 * Sa session est attachée si elle existe, sinon la requête continue quand même.
 */
async function attachUser(req: Request, _res: Response, next: NextFunction) {
  req.user = (await resolveUser(req)) ?? undefined;
  next();
}

const router = Router();

/**
 * L'utilisateur reçoit ses infos de compte après signup/signin/session.
 * passwordHash et token ne sont jamais renvoyés au client.
 */
function publicUser(user: UserDocument) {
  return {
    id: String(user._id),
    email: user.email,
    displayName: user.displayName ?? null,
  };
}

/**
 * L'utilisateur soumet le formulaire de connexion ou d'inscription.
 * Son email et son mot de passe sont extraits et nettoyés.
 */
function readCredentials(body: unknown) {
  const source = (body ?? {}) as Record<string, unknown>;
  return {
    email: typeof source.email === "string" ? source.email.trim().toLowerCase() : "",
    password: typeof source.password === "string" ? source.password : "",
    displayName: typeof source.displayName === "string" ? source.displayName.trim() : undefined,
  };
}

/**
 * L'utilisateur s'inscrit via la route /signup.
 * Son compte est créé et sa session s'ouvre aussitôt.
 */
router.post("/signup", async (req, res) => {
  const { email, password, displayName } = readCredentials(req.body);

  if (!EMAIL_REGEX.test(email)) {
    return res.status(400).json({ error: "Adresse email invalide" });
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return res
      .status(400)
      .json({ error: `Mot de passe trop court (${MIN_PASSWORD_LENGTH} caractères minimum)` });
  }

  if (await User.exists({ email })) {
    return res.status(409).json({ error: "Un compte existe déjà avec cet email" });
  }

  const token = uid2(TOKEN_LENGTH);

  let user: UserDocument;
  try {
    user = await User.create({
      email,
      passwordHash: await hashPassword(password),
      token,
      displayName,
    });
  } catch (error: unknown) {
    // Deux inscriptions simultanées sur le même email : l'index unique tranche.
    if (error instanceof Error && "code" in error && error.code === 11000) {
      return res.status(409).json({ error: "Un compte existe déjà avec cet email" });
    }
    throw error;
  }

  res.status(201).json({ user: publicUser(user), token });
});

/**
 * L'utilisateur se connecte via la route /signin.
 * Il reste connecté et reçoit son token de session.
 */
router.post("/signin", async (req, res) => {
  const { email, password } = readCredentials(req.body);

  if (!EMAIL_REGEX.test(email) || !password) {
    return res.status(400).json({ error: "Email ou mot de passe manquant" });
  }

  // passwordHash est en select: false sur le schéma, il faut le redemander.
  const user = await User.findOne({ email }).select("+passwordHash");

  // Message volontairement identique dans les deux cas : une réponse différenciée
  // permettrait d'énumérer les comptes existants.
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return res.status(401).json({ error: "Email ou mot de passe incorrect" });
  }

  // Un nouveau token à chaque connexion : se reconnecter ailleurs invalide la
  // session précédente, un seul appareil reste connecté à la fois.
  user.token = uid2(TOKEN_LENGTH);
  await user.save();

  res.json({ user: publicUser(user), token: user.token });
});

/**
 * L'utilisateur revient sur le site et son état de session est vérifié.
 * Il récupère son profil, ou null s'il n'est pas connecté.
 */
router.get("/session", attachUser, (req, res) => {
  res.json({ user: req.user ?? null });
});

/**
 * L'utilisateur se déconnecte via la route /logout.
 * Son token est retiré et sa session devient inutilisable.
 */
router.post("/logout", requireAuth, async (req, res) => {
  await User.updateOne({ _id: req.user!.id }, { $unset: { token: "" } });
  res.json({ ok: true });
});

export default router;
