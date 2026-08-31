import { Router } from "express";
import { requireAuth } from "./auth";
import { Favorite, type FavoriteAttributes } from "../models/Favorite";

const router = Router();

/** GET /api/favorites — liste des favoris de l'utilisateur connecté. */
router.get("/", requireAuth, (req, res, next) => {
  // On lance la requête Mongo, puis on branche ce qu'il faut faire "quand la réponse arrive"
  // avec .then(), au lieu d'attendre la valeur avec await.
  Favorite.find({ user: req.user!.id })
    .sort({ createdAt: -1 })
    .then((favorites) => {
      res.json({ favorites });
    })
    // Si la requête Mongo plante (ex: DB down), on transmet l'erreur à Express
    // via next(), sinon elle serait juste perdue (promesse rejetée non gérée).
    .catch(next);
});

/** POST /api/favorites — ajoute un joueur aux favoris. Idempotent si déjà présent. */
router.post("/", requireAuth, (req, res, next) => {
  const { playerId, playerName, playerFullName, team, avatarUrl, position } = req.body as Partial<
    FavoriteAttributes
  >;

  if (!playerId || !playerName || !playerFullName || !team || !position) {
    return res.status(400).json({ error: "Champs manquants" });
  }

  Favorite.create({ user: req.user!.id, playerId, playerName, playerFullName, team, avatarUrl, position })
    .catch((error: unknown) => {
      // Index unique {user, playerId} : déjà en favori, on ignore et renvoie la liste à jour.
      // On "avale" l'erreur ici (on ne retourne rien) pour que la chaîne .then() continue normalement.
      const isDuplicate =
        error instanceof Error && "code" in error && (error as { code?: number }).code === 11000;
      if (!isDuplicate) {
        throw error; // vraie erreur : on la relance, elle sera récupérée par le .catch(next) plus bas
      }
    })
    // Qu'on vienne de créer le favori ou d'ignorer le doublon, on relit la liste à jour.
    .then(() => Favorite.find({ user: req.user!.id }).sort({ createdAt: -1 }))
    .then((favorites) => {
      res.status(201).json({ favorites });
    })
    .catch(next);
});

/** DELETE /api/favorites/:playerId — retire un joueur des favoris. */
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
