import { Router } from "express";
import dotenv from "dotenv";

dotenv.config({ quiet: true });

const router = Router();

const API_FOOTBALL_BASE_URL = "https://v3.football.api-sports.io";
const API_FOOTBALL_KEY = process.env.API_FOOTBALL_KEY?.trim() ?? "";

/**
 * TODO // Djamal — c'est ton point d'entrée sur le projet, avec /api/dashboard.
 *
 * Vérifie que la clé API_FOOTBALL_KEY fonctionne via l'endpoint le moins coûteux
 * d'API Football (`curl localhost:3000/api/football/health`) : sans 200 ici,
 * inutile d'attaquer les routes métier. Pour les routes football à ajouter
 * ensuite, réutilise le pattern fetch + clé + mapping de backend/routes/injuries.ts.
 */
router.get("/health", async (_req, res) => {
  if (!API_FOOTBALL_KEY) {
    return res.status(503).json({ ok: false, error: "API_FOOTBALL_KEY non configuré" });
  }

  try {
    const response = await fetch(`${API_FOOTBALL_BASE_URL}/status`, {
      headers: { "x-apisports-key": API_FOOTBALL_KEY },
    });

    if (!response.ok) {
      return res
        .status(response.status)
        .json({ ok: false, error: `Erreur API Football (HTTP ${response.status})` });
    }

    const body = (await response.json()) as { response?: unknown };
    res.json({ ok: true, baseUrl: API_FOOTBALL_BASE_URL, status: body.response ?? null });
  } catch (error: unknown) {
    res.status(504).json({
      ok: false,
      error: `API Football injoignable : ${error instanceof Error ? error.message : String(error)}`,
    });
  }
});

export default router;
