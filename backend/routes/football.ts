import { Router } from "express";
import { SPORTMONKS_BASE_URL, SportmonksError, sportmonksFetchEnvelope } from "./sportmonks";

const router = Router();

/**
 * TODO // Djamal — c'est ton point d'entrée sur le projet, avec /api/dashboard.
 *
 * Seule route déjà branchée sur la vraie API : elle appelle l'endpoint le moins
 * coûteux de SportMonks pour vérifier que la clé SPORTMONKS_API_TOKEN fonctionne.
 * Commence par elle (`curl localhost:3000/api/football/health`) : sans 200 ici,
 * inutile d'attaquer les routes métier.
 *
 * À faire ensuite : ajouter les routes football dont tu as besoin, en réutilisant
 * sportmonksFetch() de ./sportmonks — toute la plomberie (auth, paramètres,
 * déballage de l'enveloppe, traduction des erreurs) est déjà écrite.
 */
router.get("/health", async (_req, res) => {
  try {
    const envelope = await sportmonksFetchEnvelope<unknown[]>("/leagues", { perPage: 1 });

    res.json({
      ok: true,
      baseUrl: SPORTMONKS_BASE_URL,
      rateLimit: envelope.rate_limit ?? null,
      subscription: envelope.subscription ?? null,
    });
  } catch (error: unknown) {
    if (error instanceof SportmonksError) {
      return res.status(error.status).json({ ok: false, error: error.message });
    }
    throw error;
  }
});

export default router;
