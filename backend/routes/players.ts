import { Router } from "express";
import { MOCK_PLAYERS } from "../data/mock";
import { matchPlayer } from "../../shared/search";

const router = Router();

/**
 * TODO // Djamal — brancher API Football.
 * Remplacer MOCK_PLAYERS par un appel API Football pour la recherche et la fiche joueur.
 * Garder les formes { players } et { player } : le front n'a pas à changer.
 *
 * /search doit rester déclarée AVANT /:id, sinon "search" est pris pour un identifiant.
 */

/** Recherche par nom de joueur ou d'équipe (matchPlayer compare les deux). */
router.get("/search", (req, res) => {
  const query = typeof req.query.q === "string" ? req.query.q.trim() : "";
  res.json({ players: query ? MOCK_PLAYERS.filter((p) => matchPlayer(p, query)) : [] });
});

/** Fiche complète d'un joueur. */
router.get("/:id", (req, res) => {
  const player = MOCK_PLAYERS.find((p) => p.id === req.params.id);

  if (!player) return res.status(404).json({ error: "Joueur introuvable" });

  res.json({ player });
});

export default router;
