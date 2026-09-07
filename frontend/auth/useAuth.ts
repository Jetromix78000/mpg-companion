import { useCallback } from "react";
import { useAppDispatch, useAppSelector } from "../store";
import {
  loginDismissed,
  loginRequested,
  logout as logoutThunk,
  type AuthUser,
} from "../reducers/auth";

export type { AuthUser };

/**
 * L'utilisateur se connecte, se déconnecte ou ouvre la modale de connexion.
 * Ce hook expose ces actions aux composants sans exposer Redux directement.
 */
export function useAuth() {
  const dispatch = useAppDispatch();
  const { user, loading, isLoginOpen } = useAppSelector((state) => state.auth);

  const requestLogin = useCallback(() => dispatch(loginRequested()), [dispatch]);
  const closeLogin = useCallback(() => dispatch(loginDismissed()), [dispatch]);
  const logout = useCallback(() => dispatch(logoutThunk()).unwrap(), [dispatch]);

  return { user, loading, isLoginOpen, requestLogin, closeLogin, logout };
}
