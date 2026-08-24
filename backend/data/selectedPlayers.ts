// backend/data/selectedPlayers.ts
// Liste finale validée avec Romain (6 joueurs), avec leurs IDs API-FOOTBALL confirmés
// via GET /players?search=...&league=61&season=2024.
// Saison figée à 2024 : le plan gratuit API-FOOTBALL ne couvre que 2022-2024.

export interface SelectedPlayer {
  apiFootballId: number;
  teamId: number;
  displayName: string;
  club: string;
}

export const CURRENT_SEASON = 2024;
export const LIGUE1_ID = 61;

export const SELECTED_PLAYERS: SelectedPlayer[] = [
  { apiFootballId: 153, teamId: 85, displayName: "Ousmane Dembélé", club: "Paris Saint Germain" },
  { apiFootballId: 8489, teamId: 79, displayName: "Jonathan David", club: "Lille" },
  { apiFootballId: 1467, teamId: 80, displayName: "Alexandre Lacazette", club: "Lyon" },
  { apiFootballId: 203762, teamId: 95, displayName: "Emmanuel Emegha", club: "Strasbourg" },
  { apiFootballId: 85041, teamId: 81, displayName: "Amine Gouiri", club: "Marseille" },
  { apiFootballId: 22264, teamId: 106, displayName: "Ludovic Ajorque", club: "Stade Brestois 29" },
];