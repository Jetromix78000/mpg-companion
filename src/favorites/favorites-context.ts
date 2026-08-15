import { createContext } from "react";

export interface FavoritePlayer {
  playerId: string;
  playerName: string;
}

export interface FavoritesContextValue {
  favoriteIds: Set<string>;
  isFavorite: (playerId: string) => boolean;
  /** Ajoute ou retire un favori. Ouvre la modale de connexion si l'utilisateur est anonyme. */
  toggleFavorite: (player: FavoritePlayer) => Promise<void>;
}

export const FavoritesContext = createContext<FavoritesContextValue | null>(null);
