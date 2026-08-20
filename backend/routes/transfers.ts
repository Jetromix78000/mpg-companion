import { Router } from "express";
import { MOCK_TRANSFERS } from "../data/mock";

const router = Router();

/**
 * TODO // Romain — brancher API Football.
 * Remplacer les mocks par un appel API Football, garder la forme { transfers }.
 * Limite connue : pas de flux "derniers transferts" global côté API Football,
 * les entrées de type "Rumor" n'ont pas d'équivalent.
 */
router.get("/", (_req, res) => {
  res.json({ transfers: MOCK_TRANSFERS });
});

export default router;
