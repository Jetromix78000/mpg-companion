import { Router } from "express";
import { MOCK_TRANSFERS } from "../data/mock";

const router = Router();

/**
 * TODO // Romain — brancher SportMonks.
 * Remplacer les mocks par getLatestTransfers() de ./sportmonks. Garder la
 * forme { transfers }. Limite connue : SportMonks ne publie que des transferts actés,
 * les entrées de type "Rumor" n'ont pas d'équivalent.
 */
router.get("/", (_req, res) => {
  res.json({ transfers: MOCK_TRANSFERS });
});

export default router;
