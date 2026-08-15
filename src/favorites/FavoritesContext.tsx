import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../auth/useAuth";
import { FavoritesContext, type FavoritePlayer } from "./favorites-context";

export type { FavoritePlayer };

// L'aller-retour OAuth recharge la page : l'action en attente doit survivre au rechargement.
const PENDING_KEY = "mpg:pendingFavorite";

function readPending(): FavoritePlayer | null {
  try {
    const raw = sessionStorage.getItem(PENDING_KEY);
    return raw ? (JSON.parse(raw) as FavoritePlayer) : null;
  } catch {
    return null;
  }
}

export function FavoritesProvider({ children }: { children: React.ReactNode }) {
  const { user, requestLogin } = useAuth();
  // La liste porte aussi le nom du joueur : la sidebar doit pouvoir l'afficher sans
  // dépendre du catalogue local, qui ne contient pas les joueurs scoutés par IA.
  const [favorites, setFavorites] = useState<FavoritePlayer[]>([]);
  const favoriteIds = useMemo(
    () => new Set(favorites.map((favorite) => favorite.playerId)),
    [favorites],
  );

  const addRemote = useCallback(async (player: FavoritePlayer) => {
    const res = await fetch("/api/favorites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(player),
    });
    if (!res.ok) throw new Error("Ajout refusé");
  }, []);

  // Charge les favoris à la connexion, puis rejoue l'action mise en attente avant login.
  useEffect(() => {
    let cancelled = false;

    const sync = async () => {
      if (!user) {
        setFavorites([]);
        return;
      }

      const res = await fetch("/api/favorites");
      if (!res.ok) return;
      const data = (await res.json()) as {
        favorites: { player_id: string; player_name: string }[];
      };
      if (cancelled) return;

      const list: FavoritePlayer[] = data.favorites.map((row) => ({
        playerId: row.player_id,
        playerName: row.player_name,
      }));
      const pending = readPending();

      if (pending && !list.some((favorite) => favorite.playerId === pending.playerId)) {
        try {
          await addRemote(pending);
          list.unshift(pending);
        } catch {
          // Le favori sera simplement absent : l'utilisateur peut recliquer l'étoile.
        }
      }
      sessionStorage.removeItem(PENDING_KEY);

      if (!cancelled) setFavorites(list);
    };

    sync().catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [user, addRemote]);

  const toggleFavorite = useCallback(
    async (player: FavoritePlayer) => {
      if (!user) {
        sessionStorage.setItem(PENDING_KEY, JSON.stringify(player));
        requestLogin();
        return;
      }

      const wasFavorite = favoriteIds.has(player.playerId);

      // Mise à jour optimiste, annulée si le serveur refuse.
      setFavorites((current) =>
        wasFavorite
          ? current.filter((favorite) => favorite.playerId !== player.playerId)
          : [player, ...current],
      );

      try {
        if (wasFavorite) {
          const res = await fetch(`/api/favorites/${encodeURIComponent(player.playerId)}`, {
            method: "DELETE",
          });
          if (!res.ok) throw new Error("Suppression refusée");
        } else {
          await addRemote(player);
        }
      } catch (error) {
        setFavorites((current) =>
          wasFavorite
            ? [player, ...current]
            : current.filter((favorite) => favorite.playerId !== player.playerId),
        );
        throw error;
      }
    },
    [user, favoriteIds, requestLogin, addRemote],
  );

  const isFavorite = useCallback((playerId: string) => favoriteIds.has(playerId), [favoriteIds]);

  return (
    <FavoritesContext.Provider value={{ favorites, favoriteIds, isFavorite, toggleFavorite }}>
      {children}
    </FavoritesContext.Provider>
  );
}
