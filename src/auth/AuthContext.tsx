import React, { useCallback, useEffect, useMemo, useReducer } from "react";
import { AuthContext, type AuthUser } from "./auth-context";

export type { AuthUser };

interface AuthState {
  user: AuthUser | null;
  loading: boolean;
  isLoginOpen: boolean;
  isRecovery: boolean;
}

type AuthAction =
  | { type: "session_loaded"; user: AuthUser | null }
  | { type: "login_requested" }
  | { type: "login_dismissed" }
  | { type: "recovery_started" }
  | { type: "authenticated"; user: AuthUser }
  | { type: "logged_out" };

const INITIAL_STATE: AuthState = {
  user: null,
  loading: true,
  isLoginOpen: false,
  isRecovery: false,
};

function authReducer(state: AuthState, action: AuthAction): AuthState {
  switch (action.type) {
    case "session_loaded":
      return { ...state, user: action.user, loading: false };
    case "login_requested":
      return { ...state, isLoginOpen: true, isRecovery: false };
    case "login_dismissed":
      return { ...state, isLoginOpen: false, isRecovery: false };
    // Retour du lien de réinitialisation : la session existe déjà (posée par /api/auth/recovery),
    // il reste seulement à faire choisir un nouveau mot de passe.
    case "recovery_started":
      return { ...state, isLoginOpen: true, isRecovery: true };
    // Poser la session et fermer la modale en une seule transition : l'action qui attendait
    // le compte (ajout d'un favori) repart aussitôt, sans rendu intermédiaire incohérent.
    case "authenticated":
      return { ...state, user: action.user, isLoginOpen: false, isRecovery: false };
    case "logged_out":
      return { ...state, user: null };
  }
}

/** POST JSON vers l'API d'auth. Lève le message d'erreur renvoyé par le serveur. */
async function postJson(path: string, body: Record<string, string>) {
  let res: Response;

  try {
    res = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error("Connexion au serveur impossible");
  }

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data.error ?? "Opération impossible");
  }

  return data;
}

/** Envoie les identifiants et renvoie l'utilisateur connecté. */
async function postCredentials(path: string, email: string, password: string): Promise<AuthUser> {
  const data = await postJson(path, { email, password });

  if (data.confirmationRequired) {
    throw new Error("Compte créé : confirmez votre email avant de vous connecter");
  }

  return data.user as AuthUser;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(authReducer, INITIAL_STATE);

  // La session vit dans des cookies httpOnly : le seul moyen de la lire est de demander au serveur.
  useEffect(() => {
    let cancelled = false;

    fetch("/api/auth/me")
      .then((res) => (res.ok ? res.json() : { user: null }))
      .then((data) => {
        if (!cancelled) dispatch({ type: "session_loaded", user: data.user ?? null });
      })
      .catch(() => {
        if (!cancelled) dispatch({ type: "session_loaded", user: null });
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const requestLogin = useCallback(() => dispatch({ type: "login_requested" }), []);
  const closeLogin = useCallback(() => dispatch({ type: "login_dismissed" }), []);

  const login = useCallback(async (email: string, password: string) => {
    const user = await postCredentials("/api/auth/login", email, password);
    dispatch({ type: "authenticated", user });
  }, []);

  const signup = useCallback(async (email: string, password: string) => {
    const user = await postCredentials("/api/auth/signup", email, password);
    dispatch({ type: "authenticated", user });
  }, []);

  const startPasswordRecovery = useCallback(() => dispatch({ type: "recovery_started" }), []);

  const requestPasswordReset = useCallback(async (email: string) => {
    await postJson("/api/auth/reset-password", { email });
  }, []);

  const updatePassword = useCallback(async (password: string) => {
    await postJson("/api/auth/password", { password });
    // La session de récupération devient une session normale : on relit l'utilisateur courant.
    const me = await fetch("/api/auth/me").then((res) => res.json());
    if (me.user) dispatch({ type: "authenticated", user: me.user });
  }, []);

  const logout = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    dispatch({ type: "logged_out" });
  }, []);

  const value = useMemo(
    () => ({
      ...state,
      requestLogin,
      closeLogin,
      startPasswordRecovery,
      requestPasswordReset,
      updatePassword,
      login,
      signup,
      logout,
    }),
    [
      state,
      requestLogin,
      closeLogin,
      startPasswordRecovery,
      requestPasswordReset,
      updatePassword,
      login,
      signup,
      logout,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
