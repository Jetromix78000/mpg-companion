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
 * Tout le parcours de connexion tient dans ce fichier : hachage des mots de
 * passe, gardes de session et routes signup/signin/me/logout. Rien de tout ça
 * n'est utilisé ailleurs dans le serveur, un seul fichier suffit.
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
 * Résout l'utilisateur porté par l'en-tête `Authorization: Bearer <token>`.
 * Le token vit sur le document User : le logout le vide, ce qui suffit à le rendre
 * inutilisable. Renvoie null si l'en-tête manque ou si aucun compte ne correspond.
 */
async function resolveUser(req: Request): Promise<AuthenticatedUser | null> {
  const [scheme, token] = (req.headers.authorization ?? "").split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) return null;

  const user = await User.findOne({ token });
  if (!user) return null;

  return { id: String(user._id), email: user.email, displayName: user.displayName ?? null };
}

/** Refuse la requête en 401 si personne n'est authentifié. */
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const user = await resolveUser(req);

  if (!user) {
    return res.status(401).json({ error: "Connexion requise" });
  }

  req.user = user;
  next();
}

/**
 * Attache l'utilisateur s'il y en a un, laisse passer sinon.
 * Utilisé par GET /api/auth/session, qui répond 200 avec user:null pour un visiteur anonyme.
 */
async function attachUser(req: Request, _res: Response, next: NextFunction) {
  req.user = (await resolveUser(req)) ?? undefined;
  next();
}

const router = Router();

/** Représentation publique d'un utilisateur. Ne jamais y ajouter passwordHash ni token. */
function publicUser(user: UserDocument) {
  return {
    id: String(user._id),
    email: user.email,
    displayName: user.displayName ?? null,
  };
}

/** Lit et normalise les identifiants du corps de la requête. */
function readCredentials(body: unknown) {
  const source = (body ?? {}) as Record<string, unknown>;
  return {
    email: typeof source.email === "string" ? source.email.trim().toLowerCase() : "",
    password: typeof source.password === "string" ? source.password : "",
    displayName: typeof source.displayName === "string" ? source.displayName.trim() : undefined,
  };
}

/** Crée le compte et ouvre la session dans la foulée. */
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

/** Connexion email + mot de passe. Renvoie le token que le client stockera. */
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

/** État de session pour le client. Répond 200 avec user:null quand personne n'est connecté. */
router.get("/session", attachUser, (req, res) => {
  res.json({ user: req.user ?? null });
});

/**
 * Déconnexion : vider le token du compte suffit à le rendre inutilisable.
 */
router.post("/logout", requireAuth, async (req, res) => {
  await User.updateOne({ _id: req.user!.id }, { $unset: { token: "" } });
  res.json({ ok: true });
});

export default router;
