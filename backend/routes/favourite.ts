import { Router } from "express";
import { requireAuth } from "./auth";
import { Favorite } from "../models/Favorite";
import { SELECTED_PLAYERS } from "../data/selectedPlayers";

const router = Router();

/** Enrichit un favori avec le nom/club connu localement (data/selectedPlayers.ts). */
function withPlayerInfo(favorite: Record<string, unknown> & { playerId: number }) {
  const known = SELECTED_PLAYERS.find((p) => p.apiFootballId === favorite.playerId);
  return {
    ...favorite,
    displayName: known?.displayName ?? null,
    club: known?.club ?? null,
  };
}

/** GET /api/favourites — liste des favoris de l'utilisateur connecté. */
router.get("/", requireAuth, async (req, res) => {
  const favorites = await Favorite.find({ user: req.user!.id }).sort({ createdAt: -1 });
  res.json(favorites.map((f) => withPlayerInfo(f.toJSON())));
});

/** POST /api/favourites — ajoute un joueur aux favoris. Body attendu : { playerId } */
router.post("/", requireAuth, async (req, res) => {
  const playerId = Number((req.body as Record<string, unknown> | undefined)?.playerId);

  if (!Number.isInteger(playerId)) {
    return res.status(400).json({ error: "playerId manquant ou invalide" });
  }

  if (!SELECTED_PLAYERS.some((p) => p.apiFootballId === playerId)) {
    return res.status(400).json({ error: "Ce joueur ne fait pas partie des joueurs suivis par l'app" });
  }

  try {
    const favorite = await Favorite.create({ user: req.user!.id, playerId });
    res.status(201).json(withPlayerInfo(favorite.toJSON()));
  } catch (error: unknown) {
    // Index unique {user, playerId} : déjà en favori.
    if (error instanceof Error && "code" in error && (error as { code?: number }).code === 11000) {
      return res.status(409).json({ error: "Ce joueur est déjà dans vos favoris" });
    }
    throw error;
  }
});

/** DELETE /api/favourites/:playerId — retire un joueur des favoris. */
router.delete("/:playerId", requireAuth, async (req, res) => {
  const playerId = Number(req.params.playerId);
  if (!Number.isInteger(playerId)) {
    return res.status(400).json({ error: "playerId invalide" });
  }

  const result = await Favorite.deleteOne({ user: req.user!.id, playerId });
  if (result.deletedCount === 0) {
    return res.status(404).json({ error: "Favori introuvable" });
  }
  res.json({ ok: true });
});

export default router;