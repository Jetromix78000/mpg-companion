import React from "react";
import { useAuth } from "../auth/useAuth";
import { useFavorites } from "../auth/useFavorites";
import { PlayerAvatar } from "./PlayerAvatar";

type FavoriteViewProps = {
  onOpenPlayerByName: (query: string) => void;
};

const FavoriteView: React.FC<FavoriteViewProps> = ({ onOpenPlayerByName }) => {
  const { user } = useAuth();
  const { favorites } = useFavorites();

  if (!user) return null;

  return (
    <aside className="w-64 space-y-3">
      <h2 className="text-xs font-bold uppercase tracking-wider text-muted-text px-1">Favoris</h2>

      {favorites.length === 0 ? (
        <p className="text-xs text-on-surface-variant px-1">Aucun joueur en favori pour le moment.</p>
      ) : (
        favorites.map((fav) => (
          <div
            key={fav.playerId}
            onClick={() => onOpenPlayerByName(fav.playerName)}
            className="flex items-center gap-3 p-3 rounded-xl bg-surface-container-low border border-white/10 cursor-pointer hover:border-primary-container/40 transition-colors"
          >
            <PlayerAvatar src={fav.avatarUrl} name={fav.playerFullName} className="w-10 h-10 rounded-full" />
            <div className="min-w-0">
              <p className="text-sm font-bold text-white truncate">{fav.playerName}</p>
              <p className="text-xs text-on-surface-variant truncate">
                {fav.position} • {fav.team}
              </p>
            </div>
          </div>
        ))
      )}
    </aside>
  );
};

export default FavoriteView;
