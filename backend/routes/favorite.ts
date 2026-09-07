import { Router } from "express";
import { requireAuth } from "./auth.js";
import { Favorite, type FavoriteAttributes } from "../models/Favorite.js";

const router = Router();

/**
 * L'utilisateur ouvre sa page de profil.
 * La liste de ses joueurs favoris s'affiche.
 */
router.get("/", requireAuth, (req, res, next) => {
  Favorite.find({ user: req.user!.id })
    .sort({ createdAt: -1 })
    .then((favorites) => {
      res.json({ favorites });
    })
    .catch(next);
});

/**
 * L'utilisateur clique sur l'étoile d'un joueur pour l'ajouter en favori.
 * Le joueur rejoint sa liste, sans doublon si déjà présent.
 */
router.post("/", requireAuth, (req, res, next) => {
  const { playerId, playerName, playerFullName, team, avatarUrl, position } = req.body as Partial<
    FavoriteAttributes
  >;

  if (!playerId || !playerName || !playerFullName || !team || !position) {
    return res.status(400).json({ error: "Champs manquants" });
  }

  Favorite.create({ user: req.user!.id, playerId, playerName, playerFullName, team, avatarUrl, position })
    .catch((error: unknown) => {
      const isDuplicate =
        error instanceof Error && "code" in error && (error as { code?: number }).code === 11000;
      if (!isDuplicate) {
        throw error;
      }
    })
    // Qu'on vienne de créer le favori ou d'ignorer le doublon, on relit la liste à jour.
    .then(() => Favorite.find({ user: req.user!.id }).sort({ createdAt: -1 }))
    .then((favorites) => {
      res.status(201).json({ favorites });
    })
    .catch(next);
});

/**
 * L'utilisateur clique sur l'étoile d'un joueur déjà en favori.
 * Le joueur est retiré de sa liste.
 */
router.delete("/:playerId", requireAuth, (req, res, next) => {
  Favorite.deleteOne({ user: req.user!.id, playerId: req.params.playerId })
    // Une fois la suppression faite, on enchaîne sur une deuxième requête Mongo
    // pour renvoyer la liste à jour au front.
    .then(() => Favorite.find({ user: req.user!.id }).sort({ createdAt: -1 }))
    .then((favorites) => {
      res.json({ favorites });
    })
    .catch(next);
});

export default router;
