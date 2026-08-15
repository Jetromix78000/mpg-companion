import { createContext } from "react";

export interface AuthUser {
  id: string;
  email: string | null;
}

export interface AuthContextValue {
  user: AuthUser | null;
  /** true tant que la première vérification de session n'a pas répondu */
  loading: boolean;
  isLoginOpen: boolean;
  /** Ouvre la modale de connexion. Appelé par les actions qui exigent un compte. */
  requestLogin: () => void;
  closeLogin: () => void;
  logout: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);
