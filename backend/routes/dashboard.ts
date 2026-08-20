import { Router } from "express";
import { MOCK_PLAYERS } from "../data/mock";

const router = Router();

/**
 * TODO // Djamal — brancher API Football. C'est ta route, avec /api/football.
 * Remplacer les mocks par un appel API Football agrégeant les stats joueurs.
 * Garder la forme { topPlayers }. Vérifier d'abord la clé avec GET /api/football/health.
 */
router.get("/", (_req, res) => {
  res.json({ topPlayers: MOCK_PLAYERS });
});

export default router;
