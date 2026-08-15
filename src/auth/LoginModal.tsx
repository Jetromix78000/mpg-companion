import React, { useState } from "react";
import { X, Mail, LogIn, CheckCircle, Loader2 } from "lucide-react";
import { useAuth } from "./useAuth";

/**
 * Modale de connexion, ouverte uniquement quand une action l'exige (suivre un joueur).
 * La navigation du site reste accessible sans compte.
 */
export function LoginModal() {
  const { isLoginOpen, closeLogin } = useAuth();
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);

  if (!isLoginOpen) return null;

  const handleMagicLink = async (event: React.FormEvent) => {
    event.preventDefault();
    setStatus("sending");
    setError(null);

    try {
      const res = await fetch("/api/auth/magic-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data.error ?? "Envoi impossible");
        setStatus("idle");
        return;
      }
      setStatus("sent");
    } catch {
      setError("Connexion au serveur impossible");
      setStatus("idle");
    }
  };

  return (
    <div className="fixed inset-0 z-[110] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn">
      <div className="glass-card w-full max-w-md rounded-2xl overflow-hidden shadow-2xl relative border border-white/10">
        <button
          className="absolute top-4 right-4 p-1.5 rounded-full bg-white/5 hover:bg-white/10 text-white transition-colors"
          onClick={closeLogin}
          aria-label="Fermer"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="p-6 md:p-8 space-y-6">
          <div className="text-center space-y-2">
            <span className="inline-flex items-center gap-1.5 text-[11px] bg-primary-container/10 border border-primary-container/20 text-primary-container font-black uppercase tracking-widest px-3 py-1 rounded-full">
              <LogIn className="w-3.5 h-3.5" /> Compte
            </span>
            <h3 className="text-xl font-black text-white font-title tracking-tight mt-1">
              Connectez-vous pour suivre vos joueurs
            </h3>
            <p className="text-xs text-on-surface-variant font-medium">
              La consultation du marché, des stats et des blessures reste libre. Le compte ne sert
              qu'à retrouver vos favoris.
            </p>
          </div>

          {status === "sent" ? (
            <div className="flex items-start gap-3 bg-primary-container/10 border border-primary-container/20 rounded-xl p-4">
              <CheckCircle className="w-5 h-5 text-primary-container shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-xs font-bold text-white">Lien envoyé à {email}</p>
                <p className="text-[11px] text-on-surface-variant font-medium">
                  Ouvrez-le dans cet onglet pour retrouver l'action que vous aviez lancée.
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* Navigation pleine page : le serveur pose le cookie PKCE avant de rediriger vers Google. */}
              <a
                href="/api/auth/google"
                className="w-full py-3 px-4 bg-white text-pitch-dark font-black rounded-xl text-xs uppercase tracking-wider active:scale-95 hover:brightness-95 transition-all flex items-center justify-center gap-2.5 shadow-lg"
              >
                <GoogleGlyph />
                Continuer avec Google
              </a>

              <div className="flex items-center gap-3">
                <div className="h-px flex-1 bg-white/10" />
                <span className="text-[10px] text-muted-text font-bold uppercase tracking-widest">
                  ou
                </span>
                <div className="h-px flex-1 bg-white/10" />
              </div>

              <form onSubmit={handleMagicLink} className="space-y-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-muted-text uppercase tracking-wider">
                    Votre email
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="vous@exemple.com"
                    className="w-full h-9 bg-surface-container-high border-none text-xs font-semibold rounded-lg text-white focus:ring-1 focus:ring-primary-container px-3"
                  />
                </div>

                {error && <p className="text-[11px] text-stat-decrease font-semibold">{error}</p>}

                <button
                  type="submit"
                  disabled={status === "sending"}
                  className="w-full py-3 px-4 bg-gradient-to-r from-secondary to-primary-container text-pitch-dark font-black rounded-xl text-xs uppercase tracking-wider active:scale-95 hover:brightness-110 transition-all flex items-center justify-center gap-2 shadow-lg shadow-primary-container/5 disabled:opacity-60"
                >
                  {status === "sending" ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Mail className="w-4 h-4" />
                  )}
                  Recevoir un lien de connexion
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function GoogleGlyph() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5a5.6 5.6 0 0 1-2.4 3.7v3h3.9c2.3-2.1 3.5-5.2 3.5-8.9z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.2 0 5.9-1.1 7.9-2.9l-3.9-3c-1.1.7-2.5 1.2-4 1.2-3.1 0-5.7-2.1-6.6-4.9H1.4v3.1A12 12 0 0 0 12 24z"
      />
      <path fill="#FBBC05" d="M5.4 14.4a7.2 7.2 0 0 1 0-4.6V6.7H1.4a12 12 0 0 0 0 10.8l4-3.1z" />
      <path
        fill="#EA4335"
        d="M12 4.8c1.8 0 3.3.6 4.5 1.8l3.4-3.4A12 12 0 0 0 1.4 6.7l4 3.1C6.3 6.9 8.9 4.8 12 4.8z"
      />
    </svg>
  );
}
