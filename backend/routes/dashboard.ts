import { Router } from "express";
import { MOCK_PLAYERS } from "../data/mock";

const router = Router();

/**
 * TODO // Djamal — brancher SportMonks. C'est ta route, avec /api/football.
 * Remplacer les mocks par getDashboard() de ./sportmonks. Garder la forme
 * { topPlayers }. Vérifier d'abord la clé avec GET /api/football/health.
 */
router.get("/", (_req, res) => {
  res.json({ topPlayers: MOCK_PLAYERS });
});

export default router;
