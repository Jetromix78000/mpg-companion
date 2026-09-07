import { useEffect, useState } from "react";
import { useAppSelector } from "../store";
import { useAuth } from "./useAuth";
import type { Player } from "../../shared/types";

export interface FavoritePlayer {
  playerId: string;
  playerName: string;
  playerFullName: string;
  team: string;
  avatarUrl?: string;
  position: string;
}

/**
 * L'utilisateur ouvre une vue qui affiche ou modifie ses favoris
 * (FavoriteView, ProfileView). Ce hook centralise la liste et le
 * toggle pour que les deux vues restent synchronisées entre elles.
 */
export function useFavorites() {
  const { user } = useAuth();
  const token = useAppSelector((state) => state.auth.token);
  const [favorites, setFavorites] = useState<FavoritePlayer[]>([]);

  useEffect(() => {
    if (!user) return;
    fetch("/api/favorites", { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => res.json())
      .then((data: { favorites: FavoritePlayer[] }) => setFavorites(data.favorites))
      .catch(() => setFavorites([]));
  }, [user, token]);

  const visibleFavorites = user ? favorites : [];

  function isFavorite(playerId: string): boolean {
    return visibleFavorites.some((f) => f.playerId === playerId);
  }

  /**
   * L'utilisateur clique l'étoile sur la fiche d'un joueur.
   * Le joueur est ajouté ou retiré côté serveur, puis la liste locale
   * est mise à jour pour que FavoriteView et ProfileView restent synchro.
   */
  function toggleFavorite(player: Player): Promise<void> {
    const already = isFavorite(player.id);

    const request = already
      ? fetch(`/api/favorites/${player.id}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        })
      : fetch("/api/favorites", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            playerId: player.id,
            playerName: player.name,
            playerFullName: player.fullName,
            team: player.team,
            avatarUrl: player.avatarUrl,
            position: player.position,
          }),
        });

    return request.then((res) => {
      if (!res.ok) throw new Error("Opération impossible");
      setFavorites((prev) =>
        already
          ? prev.filter((f) => f.playerId !== player.id)
          : [
              ...prev,
              {
                playerId: player.id,
                playerName: player.name,
                playerFullName: player.fullName,
                team: player.team,
                avatarUrl: player.avatarUrl,
                position: player.position,
              },
            ],
      );
    });
  }

  return { favorites: visibleFavorites, isFavorite, toggleFavorite };
}
