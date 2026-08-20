import { Router } from "express";
import { LIGUE_1_CLUBS, MOCK_INJURIES } from "../data/mock";

const router = Router();

/**
 * TODO // Romain — brancher SportMonks.
 * Remplacer les mocks par getInjuries() de ./sportmonks. Garder la forme
 * { injuries, clubs }. Piège : pas d'endpoint /injuries chez SportMonks, tout passe
 * par l'include `sidelined` d'une équipe — lire le commentaire de getInjuries().
 */
router.get("/", (_req, res) => {
  res.json({ injuries: MOCK_INJURIES, clubs: LIGUE_1_CLUBS });
});

export default router;
