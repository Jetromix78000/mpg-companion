import React, { useCallback, useEffect, useReducer } from "react";
import { X, LogIn, Lock, Loader2, CheckCircle } from "lucide-react";
import { useAuth } from "./useAuth";

const MIN_PASSWORD_LENGTH = 8;

type Mode = "login" | "signup" | "forgot";

interface FormState {
  mode: Mode;
  email: string;
  password: string;
  submitting: boolean;
  error: string | null;
  /** Email de réinitialisation parti : on remplace le formulaire par une confirmation. */
  resetSent: boolean;
}

type FormAction =
  | { type: "mode_changed"; mode: Mode }
  | { type: "field_changed"; field: "email" | "password"; value: string }
  | { type: "submitted" }
  | { type: "failed"; error: string }
  | { type: "reset_sent" }
  | { type: "reset" };

const INITIAL_FORM: FormState = {
  mode: "login",
  email: "",
  password: "",
  submitting: false,
  error: null,
  resetSent: false,
};

function formReducer(state: FormState, action: FormAction): FormState {
  switch (action.type) {
    // Changer d'onglet vide le mot de passe et l'erreur : les règles ne sont pas les mêmes
    // d'un mode à l'autre, garder l'ancien message induirait en erreur.
    case "mode_changed":
      return { ...state, mode: action.mode, password: "", error: null, resetSent: false };
    case "field_changed":
      return { ...state, [action.field]: action.value, error: null };
    case "submitted":
      return { ...state, submitting: true, error: null };
    case "failed":
      return { ...state, submitting: false, error: action.error };
    case "reset_sent":
      return { ...state, submitting: false, resetSent: true };
    case "reset":
      return INITIAL_FORM;
  }
}

/**
 * Modale de connexion, ouverte uniquement quand une action l'exige (suivre un joueur).
 * La navigation du site reste accessible sans compte.
 */
export function LoginModal() {
  const {
    isLoginOpen,
    isRecovery,
    closeLogin,
    login,
    signup,
    requestPasswordReset,
    updatePassword,
  } = useAuth();
  const [form, dispatch] = useReducer(formReducer, INITIAL_FORM);

  // La modale reste montée en permanence : sans ce reset, le mot de passe saisi resterait
  // en mémoire et serait réaffiché à la prochaine ouverture.
  useEffect(() => {
    if (!isLoginOpen) dispatch({ type: "reset" });
  }, [isLoginOpen]);

  const handleSubmit = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();
      dispatch({ type: "submitted" });

      try {
        // Session de récupération déjà ouverte par /api/auth/recovery : seul le mot de passe manque.
        if (isRecovery) {
          await updatePassword(form.password);
          return;
        }
        if (form.mode === "forgot") {
          await requestPasswordReset(form.email);
          dispatch({ type: "reset_sent" });
          return;
        }
        if (form.mode === "login") {
          await login(form.email, form.password);
        } else {
          await signup(form.email, form.password);
        }
        // Succès : le provider referme la modale.
      } catch (err) {
        dispatch({ type: "failed", error: (err as Error).message });
      }
    },
    [
      isRecovery,
      form.mode,
      form.email,
      form.password,
      login,
      signup,
      requestPasswordReset,
      updatePassword,
    ],
  );

  if (!isLoginOpen) return null;

  const isSignup = form.mode === "signup";
  const isForgot = form.mode === "forgot";

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
              {isRecovery
                ? "Choisissez un nouveau mot de passe"
                : isForgot
                  ? "Réinitialiser votre mot de passe"
                  : "Connectez-vous pour suivre vos joueurs"}
            </h3>
            <p className="text-xs text-on-surface-variant font-medium">
              {isRecovery
                ? "Votre lien est validé. Ce mot de passe remplacera l'ancien immédiatement."
                : isForgot
                  ? "Nous vous envoyons un lien pour définir un nouveau mot de passe."
                  : "La consultation du marché, des stats et des blessures reste libre. Le compte ne sert qu'à retrouver vos favoris."}
            </p>
          </div>

          {!isRecovery && !isForgot && (
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

              <div className="flex gap-1 bg-surface-container-high rounded-xl p-1">
                {(["login", "signup"] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => dispatch({ type: "mode_changed", mode })}
                    className={`flex-1 py-2 rounded-lg text-[11px] font-black uppercase tracking-wider transition-all ${
                      form.mode === mode
                        ? "bg-primary-container/10 text-primary-container"
                        : "text-muted-text hover:text-white"
                    }`}
                  >
                    {mode === "login" ? "Connexion" : "Inscription"}
                  </button>
                ))}
              </div>
            </>
          )}

          {form.resetSent ? (
            <div className="flex items-start gap-3 bg-primary-container/10 border border-primary-container/20 rounded-xl p-4">
              <CheckCircle className="w-5 h-5 text-primary-container shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-xs font-bold text-white">Lien envoyé à {form.email}</p>
                <p className="text-[11px] text-on-surface-variant font-medium">
                  Si un compte existe pour cette adresse, vous recevrez un lien pour définir un
                  nouveau mot de passe.
                </p>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-3">
              {/* En récupération, la session est déjà ouverte : l'email n'est plus demandé. */}
              {!isRecovery && (
                <div className="space-y-1">
                  <label
                    htmlFor="auth-email"
                    className="text-[10px] font-bold text-muted-text uppercase tracking-wider"
                  >
                    Votre email
                  </label>
                  <input
                    id="auth-email"
                    type="email"
                    required
                    autoComplete="email"
                    value={form.email}
                    onChange={(e) =>
                      dispatch({ type: "field_changed", field: "email", value: e.target.value })
                    }
                    placeholder="vous@exemple.com"
                    className="w-full h-9 bg-surface-container-high border-none text-xs font-semibold rounded-lg text-white focus:ring-1 focus:ring-primary-container px-3"
                  />
                </div>
              )}

              {!isForgot && (
                <div className="space-y-1">
                  <label
                    htmlFor="auth-password"
                    className="text-[10px] font-bold text-muted-text uppercase tracking-wider"
                  >
                    {isRecovery ? "Nouveau mot de passe" : "Mot de passe"}
                  </label>
                  <input
                    id="auth-password"
                    type="password"
                    required
                    minLength={isSignup || isRecovery ? MIN_PASSWORD_LENGTH : undefined}
                    autoComplete={isSignup || isRecovery ? "new-password" : "current-password"}
                    value={form.password}
                    onChange={(e) =>
                      dispatch({ type: "field_changed", field: "password", value: e.target.value })
                    }
                    placeholder="••••••••"
                    className="w-full h-9 bg-surface-container-high border-none text-xs font-semibold rounded-lg text-white focus:ring-1 focus:ring-primary-container px-3"
                  />
                  {(isSignup || isRecovery) && (
                    <p className="text-[10px] text-muted-text font-medium">
                      Minimum {MIN_PASSWORD_LENGTH} caractères.
                    </p>
                  )}
                </div>
              )}

              {form.error && (
                <p className="text-[11px] text-stat-decrease font-semibold">{form.error}</p>
              )}

              <button
                type="submit"
                disabled={form.submitting}
                className="w-full py-3 px-4 bg-gradient-to-r from-secondary to-primary-container text-pitch-dark font-black rounded-xl text-xs uppercase tracking-wider active:scale-95 hover:brightness-110 transition-all flex items-center justify-center gap-2 shadow-lg shadow-primary-container/5 disabled:opacity-60"
              >
                {form.submitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Lock className="w-4 h-4" />
                )}
                {isRecovery
                  ? "Enregistrer le mot de passe"
                  : isForgot
                    ? "Recevoir un lien de réinitialisation"
                    : isSignup
                      ? "Créer mon compte"
                      : "Se connecter"}
              </button>
            </form>
          )}

          {/* Réservé au mode connexion : à l'inscription il n'y a pas encore de mot de passe à oublier. */}
          {!isRecovery && !isSignup && (
            <button
              type="button"
              onClick={() =>
                dispatch({ type: "mode_changed", mode: isForgot ? "login" : "forgot" })
              }
              className="w-full text-[11px] font-bold text-muted-text hover:text-primary-container transition-colors"
            >
              {isForgot ? "Retour à la connexion" : "Mot de passe oublié ?"}
            </button>
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
