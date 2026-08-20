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
 * Adaptateur au-dessus du store : conserve la signature utilisée par les composants,
 * pour que le passage de React Context à Redux ne se propage pas dans toute l'UI.
 *
 * signup/signin ne sont pas ici : LoginModal fait son fetch directement et
 * dispatch sessionStarted() lui-même, pas de thunk intermédiaire pour ces deux-là.
 */
export function useAuth() {
  const dispatch = useAppDispatch();
  const { user, loading, isLoginOpen } = useAppSelector((state) => state.auth);

  const requestLogin = useCallback(() => dispatch(loginRequested()), [dispatch]);
  const closeLogin = useCallback(() => dispatch(loginDismissed()), [dispatch]);
  const logout = useCallback(() => dispatch(logoutThunk()).unwrap(), [dispatch]);

  return { user, loading, isLoginOpen, requestLogin, closeLogin, logout };
}
