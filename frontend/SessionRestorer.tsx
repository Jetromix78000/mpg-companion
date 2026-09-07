import { useEffect } from "react";
import { useAppDispatch } from "./store";
import { fetchSession } from "./reducers/auth";

/**
 * L'utilisateur revient sur le site avec un token en localStorage.
 * Sa session est revérifiée auprès du serveur au démarrage.
 */
export function SessionRestorer() {
  const dispatch = useAppDispatch();

  useEffect(() => {
    dispatch(fetchSession());
  }, [dispatch]);

  return null;
}
