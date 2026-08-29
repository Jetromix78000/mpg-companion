import { Router } from "express";
import { requireAuth } from "./auth";
import { Favorite, type FavoriteAttributes } from "../models/Favorite";

const router = Router();

/** GET /api/favorites — liste des favoris de l'utilisateur connecté. */
router.get("/", requireAuth, async (req, res) => {
  const favorites = await Favorite.find({ user: req.user!.id }).sort({ createdAt: -1 });
  res.json({ favorites });
});

/** POST /api/favorites — ajoute un joueur aux favoris. Idempotent si déjà présent. */
router.post("/", requireAuth, async (req, res) => {
  const { playerId, playerName, playerFullName, team, avatarUrl, position } = req.body as Partial<
    FavoriteAttributes
  >;

  if (!playerId || !playerName || !playerFullName || !team || !position) {
    return res.status(400).json({ error: "Champs manquants" });
  }

  try {
    await Favorite.create({ user: req.user!.id, playerId, playerName, playerFullName, team, avatarUrl, position });
  } catch (error: unknown) {
    // Index unique {user, playerId} : déjà en favori, on ignore et renvoie la liste à jour.
    if (!(error instanceof Error && "code" in error && (error as { code?: number }).code === 11000)) {
      throw error;
    }
  }

  const favorites = await Favorite.find({ user: req.user!.id }).sort({ createdAt: -1 });
  res.status(201).json({ favorites });
});

/** DELETE /api/favorites/:playerId — retire un joueur des favoris. */
router.delete("/:playerId", requireAuth, async (req, res) => {
  await Favorite.deleteOne({ user: req.user!.id, playerId: req.params.playerId });
  const favorites = await Favorite.find({ user: req.user!.id }).sort({ createdAt: -1 });
  res.json({ favorites });
});

export default router;
