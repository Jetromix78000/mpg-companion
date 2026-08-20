import { Router } from "express";
<<<<<<< HEAD
import { asyncHandler } from "../utils/asyncHandler";
import {
  getDefaultLeagueId,
  getLiveScores,
  getStandings,
  getUpcomingFixtures,
  isSportmonksConfigured,
} from "../services/sportmonks";

const router = Router();

router.use((_req, res, next) => {
  if (!isSportmonksConfigured()) {
    return res
      .status(503)
      .json({ error: "Dashboard indisponible : SPORTMONKS_API_TOKEN non configuré" });
  }
  next();
});

/**
 * GET /api/dashboard?leagueId= — digest agrégé pour la page d'accueil du frontend :
 * prochains matchs, top du classement, scores en direct s'il y en a.
 *
 * Chaque sous-appel est isolé via Promise.allSettled : si SportMonks échoue sur un
 * seul des trois, le dashboard reste utilisable avec les autres blocs plutôt que de
 * planter entièrement (important en démo devant jury).
 */
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const leagueId = req.query.leagueId
      ? Number.parseInt(String(req.query.leagueId), 10)
      : getDefaultLeagueId();

    const [fixturesResult, standingsResult, liveResult] = await Promise.allSettled([
      getUpcomingFixtures(leagueId, 7),
      getStandings(leagueId),
      getLiveScores(leagueId),
    ]);

    const unwrap = <T>(result: PromiseSettledResult<T>, label: string) => {
      if (result.status === "fulfilled") return result.value;
      console.error(`Erreur dashboard (${label}) :`, result.reason);
      return null;
    };

    const fixtures = unwrap(fixturesResult, "fixtures") as unknown[] | null;
    const standings = unwrap(standingsResult, "standings") as unknown[] | null;
    const live = unwrap(liveResult, "live") as unknown[] | null;

    res.json({
      leagueId,
      generatedAt: new Date().toISOString(),
      nextFixtures: Array.isArray(fixtures) ? fixtures.slice(0, 5) : [],
      standingsTop: Array.isArray(standings) ? standings.slice(0, 5) : [],
      live: Array.isArray(live) ? live : [],
      partial: fixturesResult.status === "rejected" || standingsResult.status === "rejected" || liveResult.status === "rejected",
    });
  }),
);

=======
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

>>>>>>> 31b5070cd4779519d2c2670f740f109635006e5f
export default router;
