import { Star, ChevronRight } from "lucide-react";
import { useFavorites } from "../favorites/useFavorites";
import type { FavoritePlayer } from "../favorites/favorites-context";

interface FavoritesViewProps {
  onOpenFavorite: (favorite: FavoritePlayer) => void;
}

/** Liste des joueurs suivis. Rendue uniquement pour un utilisateur connecté (cf. openFavoritesTab). */
export default function FavoritesView({ onOpenFavorite }: FavoritesViewProps) {
  const { favorites } = useFavorites();

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="flex items-center gap-3">
        <div className="w-1 h-6 bg-primary-container rounded-full" />
        <h2 className="text-xl font-black text-white font-title tracking-tight">Mes Favoris</h2>
        {favorites.length > 0 && (
          <span className="text-[10px] bg-primary-container/10 border border-primary-container/20 text-primary-container font-black uppercase tracking-widest px-2.5 py-1 rounded-full">
            {favorites.length} suivi{favorites.length > 1 ? "s" : ""}
          </span>
        )}
      </div>

      {favorites.length === 0 ? (
        <div className="glass-card rounded-2xl border border-white/10 p-10 flex flex-col items-center text-center gap-3">
          <div className="w-12 h-12 rounded-full bg-primary-container/10 border border-primary-container/20 flex items-center justify-center">
            <Star className="w-5 h-5 text-primary-container" />
          </div>
          <p className="text-sm font-black text-white">Aucun joueur suivi</p>
          <p className="text-xs text-on-surface-variant font-medium max-w-xs">
            Ouvrez la fiche d'un joueur et cliquez sur l'étoile pour le retrouver ici.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {favorites.map((favorite) => (
            <button
              key={favorite.playerId}
              onClick={() => onOpenFavorite(favorite)}
              className="glass-card rounded-2xl border border-white/10 p-4 flex items-center gap-3 text-left hover:border-primary-container/30 hover:bg-white/5 active:scale-[0.98] transition-all group"
            >
              <div className="w-9 h-9 rounded-xl bg-primary-container/10 border border-primary-container/20 flex items-center justify-center shrink-0">
                <Star className="w-4 h-4 text-primary-container fill-primary-container" />
              </div>
              <span className="flex-1 text-xs font-black text-white truncate">
                {favorite.playerName}
              </span>
              <ChevronRight className="w-4 h-4 text-muted-text group-hover:text-primary-container transition-colors shrink-0" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
