export enum PlayerPosition {
  Gk = "G",
  Def = "D",
  Mid = "M",
  Fwd = "A",
  Ent = "Coach",
}

export enum InjuryStatus {
  Absent = "Absent",
  Incertain = "Incertain",
  Reprise = "Reprise",
  Suspendu = "Suspendu",
}

export interface Player {
  id: string;
  name: string;
  fullName: string;
  age: number;
  country: string;
  position: string;
  positionLong: string;
  team: string;
  teamLogoUrl?: string;
  avatarUrl: string;
  form: number;
  note: number;
  goals: number;
  assists?: number;
  starts: string;
  minPerMatch: string;
  goalsPer90: number;
  probabilityToPlay: number;
  iaJustification: string;
  recentNotes: number[];
  styleTags: string[];
  lastMatches: {
    opponent: string;
    result: string;
    minutes: string;
    goals: number;
    note: number;
    isWin: boolean;
  }[];
  comparison: {
    alternativeName: string;
    stats: {
      label: string;
      playerVal: number;
      altVal: number;
      maxVal: number;
    }[];
    impact: string;
  };
}

export interface TransferMovement {
  id: string;
  playerName: string;
  avatarUrl: string;
  fromTeam: string;
  toTeam: string;
  description: string;
  amount: string;
  time: string;
  type: "Official" | "Rumor" | "Prolongation";
  confidence?: number; // 0 to 100 for rumors
  statusLabel?: string; // e.g. "Dossier très chaud", "Négociations", "Refusé", "Quasi-bouclé"
}

export interface InjuryItem {
  id: string;
  playerName: string;
  avatarUrl: string;
  clubName: string;
  clubLogoUrl?: string;
  league: string;
  type: string;
  detail: string;
  estimatedReturn: string;
  status: InjuryStatus;
  confidence: number; // 0-100
}
