import React, { useState } from "react";
import { Star, Loader2 } from "lucide-react";
import { useFavorites } from "../favorites/useFavorites";
import { useAuth } from "../auth/useAuth";

interface FavoriteButtonProps {
  playerId: string;
  playerName: string;
  onShowToast: (message: string, type?: "success" | "warning") => void;
}

/** Étoile de suivi. Seul point du site qui exige un compte. */
export function FavoriteButton({ playerId, playerName, onShowToast }: FavoriteButtonProps) {
  const { isFavorite, toggleFavorite } = useFavorites();
  const { user } = useAuth();
  const [pending, setPending] = useState(false);

  const active = isFavorite(playerId);

  const handleClick = async () => {
    setPending(true);
    try {
      await toggleFavorite({ playerId, playerName });
      if (user) {
        onShowToast(
          active ? `${playerName} retiré des favoris` : `${playerName} ajouté à vos favoris`,
          "success",
        );
      }
    } catch {
      onShowToast("Action impossible, réessayez", "warning");
    } finally {
      setPending(false);
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={pending}
      aria-pressed={active}
      title={active ? "Retirer des favoris" : "Suivre ce joueur"}
      className={`p-2.5 rounded-xl border transition-all active:scale-95 disabled:opacity-60 ${
        active
          ? "bg-primary-container/15 border-primary-container/30 text-primary-container"
          : "bg-white/5 border-white/10 text-on-surface-variant hover:text-white hover:bg-white/10"
      }`}
    >
      {pending ? (
        <Loader2 className="w-4.5 h-4.5 animate-spin" />
      ) : (
        <Star className={`w-4.5 h-4.5 ${active ? "fill-current" : ""}`} />
      )}
    </button>
  );
}
