import { Router } from "express";
import dotenv from "dotenv";
import { LIGUE_1_CLUBS } from "../data/mock";
import { InjuryStatus, type InjuryItem } from "../../shared/types";

dotenv.config({ quiet: true });

const router = Router();

const API_FOOTBALL_BASE_URL = "https://v3.football.api-sports.io";
const LIGUE_1_LEAGUE_ID = 61;
const CURRENT_SEASON = 2024;

const API_FOOTBALL_KEY = process.env.API_FOOTBALL_KEY?.trim() ?? "";

interface ApiFootballInjury {
  player: { id: number; name: string; photo: string; type: string; reason: string };
  team: { id: number; name: string; logo: string };
}

function mapInjuryStatus(type: string): InjuryStatus {
  const normalized = type.toLowerCase();
  if (normalized.includes("suspend")) return InjuryStatus.Suspendu;
  if (normalized.includes("doubt") || normalized.includes("question")) return InjuryStatus.Incertain;
  return InjuryStatus.Absent;
}

function mapInjury(raw: ApiFootballInjury): InjuryItem {
  return {
    id: String(raw.player.id),
    playerName: raw.player.name,
    avatarUrl: raw.player.photo,
    clubName: raw.team.name,
    clubLogoUrl: raw.team.logo,
    league: "Ligue 1",
    type: raw.player.type,
    detail: raw.player.reason,
    estimatedReturn: "Inconnu",
    status: mapInjuryStatus(raw.player.type),
    confidence: 100,
  };
}

/** GET /injuries?league=61&season=2024 — pas de mock, source unique API Football. */
router.get("/", async (_req, res) => {
  if (!API_FOOTBALL_KEY) {
    return res.status(503).json({ error: "API_FOOTBALL_KEY non configuré" });
  }

  try {
    const response = await fetch(
      `${API_FOOTBALL_BASE_URL}/injuries?league=${LIGUE_1_LEAGUE_ID}&season=${CURRENT_SEASON}`,
      { headers: { "x-apisports-key": API_FOOTBALL_KEY } },
    );

    if (!response.ok) {
      return res.status(response.status).json({ error: `Erreur API Football (HTTP ${response.status})` });
    }

    const body = (await response.json()) as { response: ApiFootballInjury[] };
    const injuries = body.response.map(mapInjury);

    res.json({ injuries, clubs: LIGUE_1_CLUBS });
  } catch (error: unknown) {
    res.status(504).json({
      error: `API Football injoignable : ${error instanceof Error ? error.message : String(error)}`,
    });
  }
});

export default router;
