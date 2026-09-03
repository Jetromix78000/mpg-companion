import { Router } from "express";
import type { Player } from "../../shared/types.js";
import { matchPlayer } from "../../shared/search.js";

/** Logique du mock data
 * Trois joueurs, un par club, repris à l'identique dans dashboard.ts,
 * transfers.ts, injuries.ts et football.ts. Objets volontairement
 * COMPLETS (ProfileView lit tous les champs imbriqués) et orthographe
 * des clubs identique dans les cinq routes — sinon les filtres cassent.
 */
const MOCK_PLAYERS: Player[] = [
  {
    id: "dembele",
    name: "Dembélé",
    fullName: "Ousmane Dembélé",
    age: 29,
    country: "France",
    position: "BU",
    positionLong: "Buteur",
    team: "Paris Saint Germain",
    teamLogoUrl: "https://media.api-sports.io/football/teams/85.png",
    avatarUrl: "https://media.api-sports.io/football/players/153.png",
    form: 88,
    note: 7.9,
    goals: 14,
    assists: 8,
    starts: "15/16",
    minPerMatch: "84'",
    goalsPer90: 0.79,
    probabilityToPlay: 92,
    iaJustification:
      "Repositionné dans l'axe, Dembélé enchaîne les titularisations sans alerte physique depuis la reprise.",
    recentNotes: [7.5, 8.0, 6.5, 8.5, 9.0],
    styleTags: ["Dribbleur", "Finisseur"],
    lastMatches: [
      { opponent: "Lille", result: "V 3-1", minutes: "88'", goals: 2, note: 9.0, isWin: true },
      { opponent: "Lyon", result: "N 1-1", minutes: "90'", goals: 0, note: 6.5, isWin: false },
      { opponent: "RC Lens", result: "V 2-0", minutes: "76'", goals: 1, note: 8.5, isWin: true },
    ],
    comparison: {
      alternativeName: "Bradley Barcola",
      stats: [
        { label: "xG / 90min", playerVal: 0.79, altVal: 0.48, maxVal: 1.0 },
        { label: "Forme (5m)", playerVal: 88, altVal: 71, maxVal: 100 },
        { label: "Note MPG Moy.", playerVal: 7.9, altVal: 6.8, maxVal: 10.0 },
      ],
      impact: "-18%",
    },
  },
  {
    id: "david",
    name: "David",
    fullName: "Jonathan David",
    age: 26,
    country: "Canada",
    position: "BU",
    positionLong: "Avant-centre",
    team: "Lille",
    teamLogoUrl: "https://media.api-sports.io/football/teams/79.png",
    avatarUrl: "https://media.api-sports.io/football/players/8489.png",
    form: 76,
    note: 7.1,
    goals: 11,
    assists: 3,
    starts: "14/16",
    minPerMatch: "81'",
    goalsPer90: 0.68,
    probabilityToPlay: 64,
    iaJustification:
      "Rendement constant devant le but, mais une gêne aux ischio-jambiers depuis deux journées rend sa titularisation incertaine.",
    recentNotes: [7.0, 7.5, 8.0, 6.5, 6.0],
    styleTags: ["Renard des surfaces", "Pressing"],
    lastMatches: [
      { opponent: "Paris Saint Germain", result: "D 1-3", minutes: "90'", goals: 1, note: 6.0, isWin: false },
      { opponent: "Stade Rennais", result: "V 2-1", minutes: "78'", goals: 1, note: 7.5, isWin: true },
      { opponent: "AS Monaco", result: "N 0-0", minutes: "90'", goals: 0, note: 6.5, isWin: false },
    ],
    comparison: {
      alternativeName: "Hákon Haraldsson",
      stats: [
        { label: "xG / 90min", playerVal: 0.68, altVal: 0.34, maxVal: 1.0 },
        { label: "Forme (5m)", playerVal: 76, altVal: 69, maxVal: 100 },
        { label: "Note MPG Moy.", playerVal: 7.1, altVal: 6.5, maxVal: 10.0 },
      ],
      impact: "-12%",
    },
  },
  {
    id: "lacazette",
    name: "Lacazette",
    fullName: "Alexandre Lacazette",
    age: 35,
    country: "France",
    position: "BU",
    positionLong: "Avant-centre",
    team: "Lyon",
    teamLogoUrl: "https://media.api-sports.io/football/teams/80.png",
    avatarUrl: "https://media.api-sports.io/football/players/1467.png",
    form: 69,
    note: 6.8,
    goals: 8,
    assists: 5,
    starts: "11/16",
    minPerMatch: "68'",
    goalsPer90: 0.61,
    probabilityToPlay: 78,
    iaJustification:
      "De retour de blessure et ménagé en fin de match : le capitaine lyonnais démarre, mais sort désormais autour de l'heure de jeu.",
    recentNotes: [6.0, 6.5, 7.0, 7.0, 7.5],
    styleTags: ["Pivot", "Coup franc"],
    lastMatches: [
      { opponent: "Paris Saint Germain", result: "N 1-1", minutes: "62'", goals: 1, note: 7.5, isWin: false },
      { opponent: "RC Lens", result: "V 2-0", minutes: "70'", goals: 0, note: 7.0, isWin: true },
      { opponent: "Olympique de Marseille", result: "D 0-2", minutes: "58'", goals: 0, note: 6.0, isWin: false },
    ],
    comparison: {
      alternativeName: "Georges Mikautadze",
      stats: [
        { label: "xG / 90min", playerVal: 0.61, altVal: 0.55, maxVal: 1.0 },
        { label: "Forme (5m)", playerVal: 69, altVal: 74, maxVal: 100 },
        { label: "Note MPG Moy.", playerVal: 6.8, altVal: 6.9, maxVal: 10.0 },
      ],
      impact: "+4%",
    },
  },
  {
    id: "neves",
    name: "Neves",
    fullName: "João Neves",
    age: 21,
    country: "Portugal",
    position: "MC",
    positionLong: "Milieu central",
    team: "Paris Saint Germain",
    teamLogoUrl: "https://media.api-sports.io/football/teams/85.png",
    avatarUrl: "https://img.a.transfermarkt.technology/portrait/big/670681-1701295511.jpg?lm=4711",
    form: 84,
    note: 7.4,
    goals: 3,
    assists: 6,
    starts: "14/16",
    minPerMatch: "87'",
    goalsPer90: 0.18,
    probabilityToPlay: 90,
    iaJustification:
      "Titulaire indiscutable au milieu parisien : volume de course intact et récupérations hautes qui rapportent des points MPG chaque journée.",
    recentNotes: [7.0, 7.5, 7.5, 8.0, 7.0],
    styleTags: ["Récupérateur", "Relanceur"],
    lastMatches: [
      { opponent: "Lille", result: "V 3-1", minutes: "90'", goals: 0, note: 7.5, isWin: true },
      { opponent: "Lyon", result: "N 1-1", minutes: "90'", goals: 1, note: 8.0, isWin: false },
      { opponent: "RC Lens", result: "V 2-0", minutes: "82'", goals: 0, note: 7.0, isWin: true },
    ],
    comparison: {
      alternativeName: "Warren Zaïre-Emery",
      stats: [
        { label: "Passes clés / 90min", playerVal: 1.4, altVal: 1.1, maxVal: 3.0 },
        { label: "Forme (5m)", playerVal: 84, altVal: 73, maxVal: 100 },
        { label: "Note MPG Moy.", playerVal: 7.4, altVal: 6.9, maxVal: 10.0 },
      ],
      impact: "-9%",
    },
  },
  {
    id: "bouaddi",
    name: "Bouaddi",
    fullName: "Ayyoub Bouaddi",
    age: 18,
    country: "France",
    position: "MC",
    positionLong: "Milieu central",
    team: "Lille",
    teamLogoUrl: "https://media.api-sports.io/football/teams/79.png",
    avatarUrl: "https://img.a.transfermarkt.technology/portrait/header/1097139-1741119960.jpg?lm=4711",
    form: 79,
    note: 7.0,
    goals: 2,
    assists: 4,
    starts: "13/16",
    minPerMatch: "79'",
    goalsPer90: 0.14,
    probabilityToPlay: 82,
    iaJustification:
      "Le jeune milieu lillois a gagné sa place dans l'entrejeu : profil peu coté pour un rendement régulier, bon rapport prix/points.",
    recentNotes: [6.5, 7.0, 7.5, 7.0, 7.5],
    styleTags: ["Sentinelle", "Percussion"],
    lastMatches: [
      { opponent: "Paris Saint Germain", result: "D 1-3", minutes: "90'", goals: 0, note: 6.5, isWin: false },
      { opponent: "Stade Rennais", result: "V 2-1", minutes: "85'", goals: 1, note: 7.5, isWin: true },
      { opponent: "AS Monaco", result: "N 0-0", minutes: "72'", goals: 0, note: 7.0, isWin: false },
    ],
    comparison: {
      alternativeName: "Ngal'ayel Mukau",
      stats: [
        { label: "Passes clés / 90min", playerVal: 1.2, altVal: 0.9, maxVal: 3.0 },
        { label: "Forme (5m)", playerVal: 79, altVal: 70, maxVal: 100 },
        { label: "Note MPG Moy.", playerVal: 7.0, altVal: 6.6, maxVal: 10.0 },
      ],
      impact: "-7%",
    },
  },
  {
    id: "tessmann",
    name: "Tessmann",
    fullName: "Tanner Tessmann",
    age: 24,
    country: "États-Unis",
    position: "MD",
    positionLong: "Milieu défensif",
    team: "Lyon",
    teamLogoUrl: "https://media.api-sports.io/football/teams/80.png",
    avatarUrl: "https://img.a.transfermarkt.technology/portrait/big/670096-1722196121.jpg?lm=4711",
    form: 72,
    note: 6.7,
    goals: 1,
    assists: 2,
    starts: "12/16",
    minPerMatch: "76'",
    goalsPer90: 0.09,
    probabilityToPlay: 74,
    iaJustification:
      "Sentinelle lyonnaise au temps de jeu variable selon l'adversaire : note plancher solide, mais peu de bonus offensifs.",
    recentNotes: [6.5, 6.5, 7.0, 6.0, 7.0],
    styleTags: ["Sentinelle", "Duels"],
    lastMatches: [
      { opponent: "Paris Saint Germain", result: "N 1-1", minutes: "90'", goals: 0, note: 7.0, isWin: false },
      { opponent: "RC Lens", result: "V 2-0", minutes: "68'", goals: 0, note: 6.5, isWin: true },
      { opponent: "Olympique de Marseille", result: "D 0-2", minutes: "90'", goals: 0, note: 6.0, isWin: false },
    ],
    comparison: {
      alternativeName: "Corentin Tolisso",
      stats: [
        { label: "Tacles / 90min", playerVal: 2.6, altVal: 1.8, maxVal: 4.0 },
        { label: "Forme (5m)", playerVal: 72, altVal: 75, maxVal: 100 },
        { label: "Note MPG Moy.", playerVal: 6.7, altVal: 6.9, maxVal: 10.0 },
      ],
      impact: "+3%",
    },
  },
  {
    id: "baidoo",
    name: "Baidoo",
    fullName: "Samson Baidoo",
    age: 22,
    country: "Autriche",
    position: "DC",
    positionLong: "Défenseur central",
    team: "RC Lens",
    teamLogoUrl: "https://media.api-sports.io/football/teams/116.png",
    avatarUrl: "https://img.a.transfermarkt.technology/portrait/big/655217-1722523870.png?lm=4711",
    form: 70,
    note: 6.6,
    goals: 1,
    assists: 0,
    starts: "10/16",
    minPerMatch: "82'",
    goalsPer90: 0.1,
    probabilityToPlay: 58,
    iaJustification:
      "Titulaire dans la charnière lensoise quand il est disponible, mais une alerte à la cheville rend la prochaine journée incertaine.",
    recentNotes: [6.0, 7.0, 6.5, 7.0, 6.5],
    styleTags: ["Jeu aérien", "Relance"],
    lastMatches: [
      { opponent: "Lyon", result: "D 0-2", minutes: "90'", goals: 0, note: 6.0, isWin: false },
      { opponent: "Paris Saint Germain", result: "D 0-2", minutes: "90'", goals: 0, note: 6.5, isWin: false },
      { opponent: "Stade Rennais", result: "V 1-0", minutes: "90'", goals: 1, note: 7.0, isWin: true },
    ],
    comparison: {
      alternativeName: "Jonathan Gradit",
      stats: [
        { label: "Duels gagnés %", playerVal: 63, altVal: 58, maxVal: 100 },
        { label: "Forme (5m)", playerVal: 70, altVal: 66, maxVal: 100 },
        { label: "Note MPG Moy.", playerVal: 6.6, altVal: 6.4, maxVal: 10.0 },
      ],
      impact: "-5%",
    },
  },
  {
    id: "bacher",
    name: "Bacher",
    fullName: "Félix Bacher",
    age: 25,
    country: "Autriche",
    position: "DC",
    positionLong: "Défenseur central",
    team: "Lyon",
    teamLogoUrl: "https://media.api-sports.io/football/teams/80.png",
    avatarUrl: "https://img.a.transfermarkt.technology/portrait/big/394134-1724845183.jpg?lm=4711",
    form: 66,
    note: 6.4,
    goals: 0,
    assists: 1,
    starts: "9/16",
    minPerMatch: "71'",
    goalsPer90: 0,
    probabilityToPlay: 68,
    iaJustification:
      "Rotation dans la défense lyonnaise : joue surtout quand la charnière titulaire souffle, note stable sans bonus.",
    recentNotes: [6.0, 6.5, 6.0, 7.0, 6.5],
    styleTags: ["Jeu aérien", "Placement"],
    lastMatches: [
      { opponent: "Paris Saint Germain", result: "N 1-1", minutes: "90'", goals: 0, note: 6.5, isWin: false },
      { opponent: "RC Lens", result: "V 2-0", minutes: "45'", goals: 0, note: 6.0, isWin: true },
      { opponent: "Olympique de Marseille", result: "D 0-2", minutes: "78'", goals: 0, note: 6.0, isWin: false },
    ],
    comparison: {
      alternativeName: "Moussa Niakhaté",
      stats: [
        { label: "Duels gagnés %", playerVal: 59, altVal: 64, maxVal: 100 },
        { label: "Forme (5m)", playerVal: 66, altVal: 71, maxVal: 100 },
        { label: "Note MPG Moy.", playerVal: 6.4, altVal: 6.7, maxVal: 10.0 },
      ],
      impact: "+6%",
    },
  },
  {
    id: "sidibe",
    name: "Sidibé",
    fullName: "Djibril Sidibé",
    age: 34,
    country: "France",
    position: "DL",
    positionLong: "Défenseur latéral",
    team: "Le Mans FC",
    avatarUrl: "https://img.a.transfermarkt.technology/portrait/big/161869-1604261378.jpg?lm=4711",
    form: 61,
    note: 6.2,
    goals: 0,
    assists: 2,
    starts: "12/16",
    minPerMatch: "85'",
    goalsPer90: 0,
    probabilityToPlay: 80,
    iaJustification:
      "Latéral d'expérience au Mans : temps de jeu garanti et centres réguliers, mais peu d'occasions de marquer.",
    recentNotes: [6.0, 6.0, 6.5, 6.5, 6.0],
    styleTags: ["Centreur", "Piston"],
    lastMatches: [
      { opponent: "Stade Rennais", result: "D 1-2", minutes: "90'", goals: 0, note: 6.0, isWin: false },
      { opponent: "AS Monaco", result: "N 1-1", minutes: "90'", goals: 0, note: 6.5, isWin: false },
      { opponent: "RC Lens", result: "V 2-1", minutes: "76'", goals: 0, note: 6.5, isWin: true },
    ],
    comparison: {
      alternativeName: "Kevin Danois",
      stats: [
        { label: "Centres réussis / 90min", playerVal: 1.9, altVal: 1.2, maxVal: 4.0 },
        { label: "Forme (5m)", playerVal: 61, altVal: 57, maxVal: 100 },
        { label: "Note MPG Moy.", playerVal: 6.2, altVal: 6.0, maxVal: 10.0 },
      ],
      impact: "-4%",
    },
  },
];

const router = Router();

/** Logique de l'ordre des routes
 * /search doit rester déclarée AVANT /:id, sinon "search" est pris pour
 * un identifiant. Cache-Control: no-cache sur les deux : Express calcule
 * un ETag et répond 304 tant que le résultat n'a pas changé.
 */

/** Recherche par nom de joueur ou d'équipe (matchPlayer compare les deux). */
router.get("/search", (req, res) => {
  const query = typeof req.query.q === "string" ? req.query.q.trim() : "";
  const found = query ? MOCK_PLAYERS.filter((p) => matchPlayer(p, query)) : [];
  res.set("Cache-Control", "no-cache");
  res.json({ players: found });
});

/** Fiche complète d'un joueur. */
router.get("/:id", (req, res) => {
  const player = MOCK_PLAYERS.find((p) => p.id === req.params.id);

  if (!player) return res.status(404).json({ error: "Joueur introuvable" });

  res.set("Cache-Control", "no-cache");
  res.json({ player });
});

export default router;
