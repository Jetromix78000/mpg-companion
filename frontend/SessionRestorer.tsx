import { useEffect } from "react";
import { useAppDispatch } from "./store";
import { fetchSession } from "./reducers/auth";

/**
 * Relit la session au démarrage. Ce composant ne rend rien : il porte le seul
 * effet qui n'appartient à aucune vue en particulier.
 *
 * Le token vit en localStorage ; seul le serveur peut dire s'il est encore valide
 * et à qui il appartient.
 */
export function SessionRestorer() {
  const dispatch = useAppDispatch();

  useEffect(() => {
    dispatch(fetchSession());
  }, [dispatch]);

  return null;
}
