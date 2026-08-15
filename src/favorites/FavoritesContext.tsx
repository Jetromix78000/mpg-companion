import React, { useCallback, useEffect, useState } from "react";
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
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());

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
        setFavoriteIds(new Set());
        return;
      }

      const res = await fetch("/api/favorites");
      if (!res.ok) return;
      const data = (await res.json()) as { favorites: { player_id: string }[] };
      if (cancelled) return;

      const ids = new Set(data.favorites.map((row) => row.player_id));
      const pending = readPending();

      if (pending && !ids.has(pending.playerId)) {
        try {
          await addRemote(pending);
          ids.add(pending.playerId);
        } catch {
          // Le favori sera simplement absent : l'utilisateur peut recliquer l'étoile.
        }
      }
      sessionStorage.removeItem(PENDING_KEY);

      if (!cancelled) setFavoriteIds(ids);
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
      setFavoriteIds((current) => {
        const next = new Set(current);
        if (wasFavorite) next.delete(player.playerId);
        else next.add(player.playerId);
        return next;
      });

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
        setFavoriteIds((current) => {
          const next = new Set(current);
          if (wasFavorite) next.add(player.playerId);
          else next.delete(player.playerId);
          return next;
        });
        throw error;
      }
    },
    [user, favoriteIds, requestLogin, addRemote],
  );

  const isFavorite = useCallback((playerId: string) => favoriteIds.has(playerId), [favoriteIds]);

  return (
    <FavoritesContext.Provider value={{ favoriteIds, isFavorite, toggleFavorite }}>
      {children}
    </FavoritesContext.Provider>
  );
}
