import { Router } from "express";
import { LIGUE_1_CLUBS, MOCK_INJURIES } from "../data/mock";

const router = Router();

/**
 * TODO // Romain — brancher API Football.
 * Remplacer les mocks par un appel GET /injuries?league=61 (voir backend/routes/transfers.ts
 * pour le pattern fetch + clé + mapping). Garder la forme { injuries, clubs }.
 */
router.get("/", (_req, res) => {
  res.json({ injuries: MOCK_INJURIES, clubs: LIGUE_1_CLUBS });
});

export default router;
