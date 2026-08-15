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
  /** true quand l'utilisateur arrive d'un lien de réinitialisation et doit choisir un mot de passe */
  isRecovery: boolean;
  /** Ouvre la modale de connexion. Appelé par les actions qui exigent un compte. */
  requestLogin: () => void;
  closeLogin: () => void;
  /** Ouvre la modale sur le formulaire de nouveau mot de passe (retour de lien de reset). */
  startPasswordRecovery: () => void;
  /** Demande l'envoi d'un email de réinitialisation. Ne révèle pas si le compte existe. */
  requestPasswordReset: (email: string) => Promise<void>;
  /** Définit un nouveau mot de passe pour la session en cours. */
  updatePassword: (password: string) => Promise<void>;
  /** Connecte l'utilisateur et ferme la modale. Rejette avec le message serveur en cas d'échec. */
  login: (email: string, password: string) => Promise<void>;
  /** Crée le compte puis connecte. Rejette avec le message serveur en cas d'échec. */
  signup: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);
