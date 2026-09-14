import { PlayerPosition } from "../../shared/types.js";

export function mapPosition(rawPosition: string | null): { short: string; long: string } {
  switch (rawPosition) {
    case "Goalkeeper":
      return { short: PlayerPosition.Gk, long: rawPosition };
    case "Defender":
      return { short: PlayerPosition.Def, long: rawPosition };
    case "Midfielder":
      return { short: PlayerPosition.Mid, long: rawPosition };
    case "Attacker":
      return { short: PlayerPosition.Fwd, long: rawPosition };
    default:
      return { short: PlayerPosition.Fwd, long: rawPosition ?? "Inconnu" };
  }
}
