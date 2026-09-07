import { useState } from "react";
import { X, LogIn, Lock, Loader2 } from "lucide-react";
import { useAppDispatch } from "../store";
import { sessionStarted, storeToken } from "../reducers/auth";
import { useAuth } from "./useAuth";

const MIN_PASSWORD_LENGTH = 8;

type Mode = "login" | "signup";

/**
 * L'utilisateur tente une action qui exige un compte (ex. suivre un joueur).
 * La modale de connexion s'ouvre, sans bloquer le reste du site.
 */
export function LoginModal() {
  const dispatch = useAppDispatch();
  const { isLoginOpen, closeLogin } = useAuth();

  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * L'utilisateur ferme la modale de connexion.
   * Email, mot de passe et erreur sont réinitialisés pour la prochaine ouverture.
   */
  const [wasOpen, setWasOpen] = useState(isLoginOpen);
  if (isLoginOpen !== wasOpen) {
    setWasOpen(isLoginOpen);
    if (!isLoginOpen) {
      setMode("login");
      setEmail("");
      setPassword("");
      setError(null);
    }
  }

  const signup = async () => {
    const response = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await response.json();

    if (!response.ok) {
      setError(data.error || "Opération impossible");
      return;
    }

    storeToken(data.token);
    dispatch(sessionStarted(data));
  };

  const signin = async () => {
    const response = await fetch("/api/auth/signin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await response.json();

    if (!response.ok) {
      setError(data.error || "Opération impossible");
      return;
    }

    storeToken(data.token);
    dispatch(sessionStarted(data));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      if (mode === "signup") {
        await signup();
      } else {
        await signin();
      }
    } catch (err) {
      console.error("Erreur d'authentification :", err);
      setError("Connexion au serveur impossible");
    } finally {
      setSubmitting(false);
    }
  };

  if (!isLoginOpen) return null;

  const isSignup = mode === "signup";

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
              {isSignup ? "Créer un compte" : "Se connecter"}
            </h3>
            <p className="text-xs text-muted-text font-medium">
              Connectez-vous pour accéder à votre espace manager.
            </p>
          </div>

          <div className="flex gap-1 p-1 bg-surface-container-low rounded-xl border border-white/5">
            {(["login", "signup"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => {
                  setMode(m);
                  setPassword("");
                  setError(null);
                }}
                className={`flex-1 py-2 rounded-lg text-xs font-bold transition-colors ${
                  mode === m
                    ? "bg-primary-container text-on-primary-container shadow-md"
                    : "text-muted-text hover:text-white"
                }`}
              >
                {m === "login" ? "Connexion" : "Inscription"}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label
                className="text-[11px] font-bold uppercase tracking-widest text-muted-text"
                htmlFor="login-email"
              >
                Email
              </label>
              <input
                id="login-email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setError(null);
                }}
                className="w-full h-11 px-4 bg-surface-container-high/60 border border-white/10 rounded-xl text-sm text-white placeholder-muted-text focus:outline-none focus:ring-1 focus:ring-primary-container focus:border-primary-container transition-all"
                placeholder="vous@exemple.com"
              />
            </div>

            <div className="space-y-1.5">
              <label
                className="text-[11px] font-bold uppercase tracking-widest text-muted-text"
                htmlFor="login-password"
              >
                Mot de passe
              </label>
              <input
                id="login-password"
                type="password"
                required
                minLength={isSignup ? MIN_PASSWORD_LENGTH : undefined}
                autoComplete={isSignup ? "new-password" : "current-password"}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError(null);
                }}
                className="w-full h-11 px-4 bg-surface-container-high/60 border border-white/10 rounded-xl text-sm text-white placeholder-muted-text focus:outline-none focus:ring-1 focus:ring-primary-container focus:border-primary-container transition-all"
                placeholder="••••••••"
              />
              {isSignup && (
                <p className="text-[10px] text-muted-text font-medium pt-0.5">
                  {MIN_PASSWORD_LENGTH} caractères minimum.
                </p>
              )}
            </div>

            {error && (
              <p className="text-xs font-semibold text-stat-decrease bg-stat-decrease/10 border border-stat-decrease/20 rounded-xl px-3 py-2.5">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full h-11 flex items-center justify-center gap-2 bg-primary-container text-on-primary-container font-bold rounded-xl active:scale-95 transition-all shadow-lg disabled:opacity-60 disabled:active:scale-100"
            >
              {submitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Lock className="w-4 h-4" />
              )}
              {isSignup ? "Créer mon compte" : "Se connecter"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
