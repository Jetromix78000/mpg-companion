import { Router } from "express";
import { InjuryStatus, type InjuryItem } from "../../shared/types.js";

/** Mock data de la route. InjuriesView l'appelle avec un vrai fetch("/api/injuries"). */
const MOCK_INJURIES: InjuryItem[] = [
  {
    id: "dembele",
    playerName: "Ousmane Dembélé",
    avatarUrl: "https://media.api-sports.io/football/players/153.png",
    clubName: "Paris Saint Germain",
    clubLogoUrl: "https://media.api-sports.io/football/teams/85.png",
    league: "Ligue 1",
    type: "Cuisse",
    detail: "2 match(s) manqué(s), dernier le 23/08/2026",
    estimatedReturn: "05/09/2026",
    status: InjuryStatus.Absent,
    confidence: 85,
  },
  {
    id: "david",
    playerName: "Jonathan David",
    avatarUrl: "https://media.api-sports.io/football/players/8489.png",
    clubName: "Lille",
    clubLogoUrl: "https://media.api-sports.io/football/teams/79.png",
    league: "Ligue 1",
    type: "Ischio-jambiers",
    detail: "0 match(s) manqué(s), gêne signalée le 24/08/2026",
    estimatedReturn: "Test à l'entraînement le 29/08/2026",
    status: InjuryStatus.Incertain,
    confidence: 55,
  },
  {
    id: "lacazette",
    playerName: "Alexandre Lacazette",
    avatarUrl: "https://media.api-sports.io/football/players/1467.png",
    clubName: "Lyon",
    league: "Ligue 1",
    type: "Mollet",
    detail: "4 match(s) manqué(s), dernier le 16/08/2026",
    estimatedReturn: "Disponible, temps de jeu limité",
    status: InjuryStatus.Reprise,
    confidence: 70,
  },
  {
    id: "baidoo",
    playerName: "Samson Baidoo",
    avatarUrl: "https://img.a.transfermarkt.technology/portrait/big/655217-1722523870.png?lm=4711",
    clubName: "RC Lens",
    clubLogoUrl: "https://media.api-sports.io/football/teams/116.png",
    league: "Ligue 1",
    type: "Cheville",
    detail: "1 match(s) manqué(s), dernier le 25/08/2026",
    estimatedReturn: "Test à l'entraînement le 30/08/2026",
    status: InjuryStatus.Incertain,
    confidence: 60,
  },
  {
    id: "neves",
    playerName: "João Neves",
    avatarUrl: "https://img.a.transfermarkt.technology/portrait/big/670681-1701295511.jpg?lm=4711",
    clubName: "Paris Saint Germain",
    clubLogoUrl: "https://media.api-sports.io/football/teams/85.png",
    league: "Ligue 1",
    type: "Suspension ... 🟥",
    detail: "Cumul de cartons jaunes, suspendu pour la 4e journée",
    estimatedReturn: "07/09/2026",
    status: InjuryStatus.Suspendu,
    confidence: 100,
  },
  {
    id: "tessmann",
    playerName: "Tanner Tessmann",
    avatarUrl: "https://img.a.transfermarkt.technology/portrait/big/670096-1722196121.jpg?lm=4711",
    clubName: "Lyon",
    clubLogoUrl: "https://media.api-sports.io/football/teams/80.png",
    league: "Ligue 1",
    type: "Adducteurs",
    detail: "3 match(s) manqué(s), dernier le 19/08/2026",
    estimatedReturn: "Disponible, retour progressif",
    status: InjuryStatus.Reprise,
    confidence: 65,
  },
  {
    id: "bacher",
    playerName: "Félix Bacher",
    avatarUrl: "https://img.a.transfermarkt.technology/portrait/big/394134-1724845183.jpg?lm=4711",
    clubName: "Lyon",
    clubLogoUrl: "https://media.api-sports.io/football/teams/80.png",
    league: "Ligue 1",
    type: "Genou",
    detail: "2 match(s) manqué(s), dernier le 23/08/2026",
    estimatedReturn: "12/09/2026",
    status: InjuryStatus.Absent,
    confidence: 80,
  },
  {
    id: "sidibe",
    playerName: "Djibril Sidibé",
    avatarUrl: "https://img.a.transfermarkt.technology/portrait/big/161869-1604261378.jpg?lm=4711",
    clubName: "Le Mans FC",
    league: "Ligue 2",
    type: "Mollet",
    detail: "0 match(s) manqué(s), gêne signalée le 26/08/2026",
    estimatedReturn: "Test à l'entraînement le 31/08/2026",
    status: InjuryStatus.Incertain,
    confidence: 45,
  },
];

/** "Tous les clubs" doit rester en tête : état initial du select d'InjuriesView. */
const MOCK_CLUBS: string[] = [
  "Tous les clubs",
  "Paris Saint Germain",
  "Lille",
  "Lyon",
  "RC Lens",
  "Le Mans FC",
];

const router = Router();

/** Logique de la route
 * Centre des blessures : les blessures et la liste de clubs qui alimente
 * le filtre. Revalidation à chaque appel : 304 tant que l'ETag n'a pas
 * changé.
 */
router.get("/", (_req, res) => {
  res.set("Cache-Control", "no-cache");
  res.json({ injuries: MOCK_INJURIES, clubs: MOCK_CLUBS });
});

export default router;
