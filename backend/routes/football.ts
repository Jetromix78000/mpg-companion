import { Router } from "express";

/** Logique du contrat de la fiche
 * Contrat de la fiche statistique détaillée, autrefois construit à partir
 * d'API Football. Conservé tel quel : la forme de réponse ne change pas.
 */
interface PlayerFootballStats {
  player: {
    id: number;
    name: string;
    fullName: string;
    age: number;
    nationality: string;
    photo: string;
    positionRaw: string | null;
  };
  team: { id: number; name: string; logo: string };
  season: number;
  presence: {
    appearances: number;
    lineups: number;
    substituteIn: number;
    minutesPlayed: number;
    minutesPerAppearance: number | null;
    attendanceRate: number | null;
  };
  performance: {
    goals: number;
    assists: number | null;
    goalsPer90: number | null;
    shotsTotal: number | null;
    shotsOnTarget: number | null;
    keyPasses: number | null;
    dribblesSuccess: number | null;
    tacklesTotal: number | null;
    duelsWonRate: number | null;
    foulsCommitted: number | null;
    yellowCards: number;
    redCards: number;
    seasonRating: number | null;
  };
  injuries: {
    isCurrentlyInjured: boolean;
    history: { date: string; type: string; reason: string; team: string; fixtureId: number }[];
  };
}

const SEASON = 2026;

/** Logique du mock data
 * Les trois mêmes joueurs que players.ts, dashboard.ts, transfers.ts et
 * injuries.ts, sous forme numérique : `id` est l'identifiant utilisé par
 * /stats?playerId=, distinct des identifiants texte ("dembele", "david").
 */
const MOCK_FOOTBALL = [
  { id: 153, name: "Ousmane Dembélé", team: "Paris Saint Germain" },
  { id: 8489, name: "Jonathan David", team: "Lille" },
  { id: 1467, name: "Alexandre Lacazette", team: "Lyon" },
  { id: 47380, name: "João Neves", team: "Paris Saint Germain" },
  { id: 397229, name: "Ayyoub Bouaddi", team: "Lille" },
  { id: 20790, name: "Tanner Tessmann", team: "Lyon" },
  { id: 380508, name: "Samson Baidoo", team: "RC Lens" },
  { id: 47338, name: "Félix Bacher", team: "Lyon" },
  { id: 2925, name: "Djibril Sidibé", team: "Le Mans FC" },
];

const MOCK_STATS: Record<number, PlayerFootballStats> = {
  153: {
    player: {
      id: 153,
      name: "Dembélé",
      fullName: "Ousmane Dembélé",
      age: 29,
      nationality: "France",
      photo: "https://media.api-sports.io/football/players/153.png",
      positionRaw: "Attacker",
    },
    team: { id: 85, name: "Paris Saint Germain", logo: "https://media.api-sports.io/football/teams/85.png" },
    season: SEASON,
    presence: {
      appearances: 16,
      lineups: 15,
      substituteIn: 1,
      minutesPlayed: 1344,
      minutesPerAppearance: 84,
      attendanceRate: 94,
    },
    performance: {
      goals: 14,
      assists: 8,
      goalsPer90: 0.79,
      shotsTotal: 52,
      shotsOnTarget: 27,
      keyPasses: 31,
      dribblesSuccess: 44,
      tacklesTotal: 9,
      duelsWonRate: 54,
      foulsCommitted: 12,
      yellowCards: 2,
      redCards: 0,
      seasonRating: 7.9,
    },
    injuries: {
      isCurrentlyInjured: true,
      history: [
        {
          date: "2026-08-23",
          type: "Missing Fixture",
          reason: "Cuisse",
          team: "Paris Saint Germain",
          fixtureId: 1210045,
        },
      ],
    },
  },
  8489: {
    player: {
      id: 8489,
      name: "David",
      fullName: "Jonathan David",
      age: 26,
      nationality: "Canada",
      photo: "https://media.api-sports.io/football/players/8489.png",
      positionRaw: "Attacker",
    },
    team: { id: 79, name: "Lille", logo: "https://media.api-sports.io/football/teams/79.png" },
    season: SEASON,
    presence: {
      appearances: 15,
      lineups: 14,
      substituteIn: 1,
      minutesPlayed: 1215,
      minutesPerAppearance: 81,
      attendanceRate: 88,
    },
    performance: {
      goals: 11,
      assists: 3,
      goalsPer90: 0.68,
      shotsTotal: 43,
      shotsOnTarget: 21,
      keyPasses: 17,
      dribblesSuccess: 12,
      tacklesTotal: 14,
      duelsWonRate: 47,
      foulsCommitted: 18,
      yellowCards: 3,
      redCards: 0,
      seasonRating: 7.1,
    },
    injuries: {
      isCurrentlyInjured: false,
      history: [
        {
          date: "2026-08-24",
          type: "Questionable",
          reason: "Ischio-jambiers",
          team: "Lille",
          fixtureId: 1210052,
        },
      ],
    },
  },
  1467: {
    player: {
      id: 1467,
      name: "Lacazette",
      fullName: "Alexandre Lacazette",
      age: 35,
      nationality: "France",
      photo: "https://media.api-sports.io/football/players/1467.png",
      positionRaw: "Attacker",
    },
    team: { id: 80, name: "Lyon", logo: "https://media.api-sports.io/football/teams/80.png" },
    season: SEASON,
    presence: {
      appearances: 13,
      lineups: 11,
      substituteIn: 2,
      minutesPlayed: 884,
      minutesPerAppearance: 68,
      attendanceRate: 76,
    },
    performance: {
      goals: 8,
      assists: 5,
      goalsPer90: 0.61,
      shotsTotal: 34,
      shotsOnTarget: 15,
      keyPasses: 22,
      dribblesSuccess: 8,
      tacklesTotal: 11,
      duelsWonRate: 51,
      foulsCommitted: 15,
      yellowCards: 1,
      redCards: 0,
      seasonRating: 6.8,
    },
    injuries: {
      isCurrentlyInjured: false,
      history: [
        {
          date: "2026-08-16",
          type: "Missing Fixture",
          reason: "Mollet",
          team: "Lyon",
          fixtureId: 1210031,
        },
      ],
    },
  },
  47380: {
    player: {
      id: 47380,
      name: "Neves",
      fullName: "João Neves",
      age: 21,
      nationality: "Portugal",
      photo: "https://img.a.transfermarkt.technology/portrait/big/670681-1701295511.jpg?lm=4711",
      positionRaw: "Midfielder",
    },
    team: { id: 85, name: "Paris Saint Germain", logo: "https://media.api-sports.io/football/teams/85.png" },
    season: SEASON,
    presence: { appearances: 16, lineups: 14, substituteIn: 2, minutesPlayed: 1392, minutesPerAppearance: 87, attendanceRate: 95 },
    performance: {
      goals: 3, assists: 6, goalsPer90: 0.18, shotsTotal: 18, shotsOnTarget: 9,
      keyPasses: 38, dribblesSuccess: 16, tacklesTotal: 41, duelsWonRate: 58,
      foulsCommitted: 14, yellowCards: 2, redCards: 0, seasonRating: 7.4,
    },
    injuries: { isCurrentlyInjured: false, history: [{ date: "2026-08-27", type: "Suspension", reason: "Cumul cartons", team: "Paris Saint Germain", fixtureId: 1210060 }] },
  },
  397229: {
    player: {
      id: 397229,
      name: "Bouaddi",
      fullName: "Ayyoub Bouaddi",
      age: 18,
      nationality: "France",
      photo: "https://img.a.transfermarkt.technology/portrait/header/1097139-1741119960.jpg?lm=4711",
      positionRaw: "Midfielder",
    },
    team: { id: 79, name: "Lille", logo: "https://media.api-sports.io/football/teams/79.png" },
    season: SEASON,
    presence: { appearances: 14, lineups: 13, substituteIn: 1, minutesPlayed: 1106, minutesPerAppearance: 79, attendanceRate: 89 },
    performance: {
      goals: 2, assists: 4, goalsPer90: 0.14, shotsTotal: 14, shotsOnTarget: 7,
      keyPasses: 29, dribblesSuccess: 22, tacklesTotal: 36, duelsWonRate: 55,
      foulsCommitted: 16, yellowCards: 1, redCards: 0, seasonRating: 7.0,
    },
    injuries: { isCurrentlyInjured: false, history: [] },
  },
  20790: {
    player: {
      id: 20790,
      name: "Tessmann",
      fullName: "Tanner Tessmann",
      age: 24,
      nationality: "États-Unis",
      photo: "https://img.a.transfermarkt.technology/portrait/big/670096-1722196121.jpg?lm=4711",
      positionRaw: "Midfielder",
    },
    team: { id: 80, name: "Lyon", logo: "https://media.api-sports.io/football/teams/80.png" },
    season: SEASON,
    presence: { appearances: 13, lineups: 12, substituteIn: 1, minutesPlayed: 988, minutesPerAppearance: 76, attendanceRate: 82 },
    performance: {
      goals: 1, assists: 2, goalsPer90: 0.09, shotsTotal: 10, shotsOnTarget: 4,
      keyPasses: 19, dribblesSuccess: 9, tacklesTotal: 49, duelsWonRate: 61,
      foulsCommitted: 21, yellowCards: 3, redCards: 0, seasonRating: 6.7,
    },
    injuries: { isCurrentlyInjured: false, history: [{ date: "2026-08-19", type: "Missing Fixture", reason: "Adducteurs", team: "Lyon", fixtureId: 1210055 }] },
  },
  380508: {
    player: {
      id: 380508,
      name: "Baidoo",
      fullName: "Samson Baidoo",
      age: 22,
      nationality: "Autriche",
      photo: "https://img.a.transfermarkt.technology/portrait/big/655217-1722523870.png?lm=4711",
      positionRaw: "Defender",
    },
    team: { id: 116, name: "RC Lens", logo: "https://media.api-sports.io/football/teams/116.png" },
    season: SEASON,
    presence: { appearances: 12, lineups: 10, substituteIn: 2, minutesPlayed: 984, minutesPerAppearance: 82, attendanceRate: 77 },
    performance: {
      goals: 1, assists: 0, goalsPer90: 0.1, shotsTotal: 8, shotsOnTarget: 3,
      keyPasses: 6, dribblesSuccess: 4, tacklesTotal: 28, duelsWonRate: 63,
      foulsCommitted: 11, yellowCards: 2, redCards: 0, seasonRating: 6.6,
    },
    injuries: { isCurrentlyInjured: true, history: [{ date: "2026-08-25", type: "Questionable", reason: "Cheville", team: "RC Lens", fixtureId: 1210058 }] },
  },
  47338: {
    player: {
      id: 47338,
      name: "Bacher",
      fullName: "Félix Bacher",
      age: 25,
      nationality: "Autriche",
      photo: "https://img.a.transfermarkt.technology/portrait/big/394134-1724845183.jpg?lm=4711",
      positionRaw: "Defender",
    },
    team: { id: 80, name: "Lyon", logo: "https://media.api-sports.io/football/teams/80.png" },
    season: SEASON,
    presence: { appearances: 11, lineups: 9, substituteIn: 2, minutesPlayed: 781, minutesPerAppearance: 71, attendanceRate: 68 },
    performance: {
      goals: 0, assists: 1, goalsPer90: 0, shotsTotal: 5, shotsOnTarget: 1,
      keyPasses: 8, dribblesSuccess: 3, tacklesTotal: 22, duelsWonRate: 59,
      foulsCommitted: 9, yellowCards: 1, redCards: 0, seasonRating: 6.4,
    },
    injuries: { isCurrentlyInjured: true, history: [{ date: "2026-08-23", type: "Missing Fixture", reason: "Genou", team: "Lyon", fixtureId: 1210050 }] },
  },
  2925: {
    player: {
      id: 2925,
      name: "Sidibé",
      fullName: "Djibril Sidibé",
      age: 34,
      nationality: "France",
      photo: "https://img.a.transfermarkt.technology/portrait/big/161869-1604261378.jpg?lm=4711",
      positionRaw: "Defender",
    },
    team: { id: 1037, name: "Le Mans FC", logo: "" },
    season: SEASON,
    presence: { appearances: 14, lineups: 12, substituteIn: 2, minutesPlayed: 1190, minutesPerAppearance: 85, attendanceRate: 88 },
    performance: {
      goals: 0, assists: 2, goalsPer90: 0, shotsTotal: 4, shotsOnTarget: 1,
      keyPasses: 12, dribblesSuccess: 7, tacklesTotal: 19, duelsWonRate: 52,
      foulsCommitted: 13, yellowCards: 2, redCards: 0, seasonRating: 6.2,
    },
    injuries: { isCurrentlyInjured: false, history: [{ date: "2026-08-26", type: "Questionable", reason: "Mollet", team: "Le Mans FC", fixtureId: 1210062 }] },
  },
};

const router = Router();

/** Logique du cache HTTP
 * "Cache-Control: no-cache" sur chaque GET : Express calcule un ETag et
 * répond 304 tant que le mock n'a pas changé, 200 sinon — comme une vraie
 * API. Non appliqué aux branches d'erreur (400) : rien à revalider.
 */

/** Contrôle de vie de la source de données. Plus de clé ni d'appel externe. */
router.get("/health", (_req, res) => {
  res.set("Cache-Control", "no-cache");
  res.json({ ok: true, source: "mock", season: SEASON, players: MOCK_FOOTBALL.length });
});

/** Fiche statistique détaillée d'un joueur sélectionné. */
router.get("/stats", (req, res) => {
  const playerIdParam = req.query.playerId;

  if (typeof playerIdParam !== "string" || !playerIdParam.trim()) {
    return res.status(400).json({ error: "Paramètre playerId manquant" });
  }

  const playerId = Number(playerIdParam);
  if (!Number.isInteger(playerId)) {
    return res.status(400).json({ error: "playerId doit être un nombre entier" });
  }

  const stats = MOCK_STATS[playerId];
  if (!stats) {
    return res.status(400).json({
      ok: false,
      error: `Joueur ${playerId} non autorisé — doit faire partie des joueurs sélectionnés`,
    });
  }

  res.set("Cache-Control", "no-cache");
  res.json(stats);
});

/** Liste des joueurs couverts. Tableau nu, comme attendu par les appelants. */
router.get("/players", (_req, res) => {
  res.set("Cache-Control", "no-cache");
  res.json(MOCK_FOOTBALL);
});

export default router;
