import { AlertCircle, Loader2 } from "lucide-react";

/**
 * L'utilisateur attend le chargement d'une vue, ou le serveur est injoignable.
 * Un loader ou un message d'erreur avec bouton "Réessayer" s'affiche.
 */

export function ViewLoader({ label }: { label: string }) {
  return (
    <div className="glass-card rounded-2xl border border-white/10 p-10 flex flex-col items-center text-center gap-3 animate-fadeIn">
      <Loader2 className="w-6 h-6 text-primary-container animate-spin" />
      <p className="text-xs text-on-surface-variant font-semibold">{label}</p>
    </div>
  );
}

export function ViewError({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="glass-card rounded-2xl border border-stat-decrease/20 px-3 py-6 sm:p-10 flex flex-col items-center text-center gap-3 animate-fadeIn">
      <AlertCircle className="w-6 h-6 text-stat-decrease" />
      <p className="text-sm font-black text-white">Données indisponibles</p>
      <p className="text-[10px] sm:text-xs text-on-surface-variant font-medium whitespace-nowrap">
        {message}
      </p>
      {onRetry && (
        <button
          className="mt-2 py-2 px-4 rounded-xl bg-white/5 border border-white/10 text-xs font-bold text-white hover:bg-white/10 active:scale-95 transition-all"
          onClick={onRetry}
        >
          Réessayer
        </button>
      )}
    </div>
  );
}
