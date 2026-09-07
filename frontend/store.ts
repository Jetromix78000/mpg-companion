import { configureStore } from "@reduxjs/toolkit";
import { useDispatch, useSelector } from "react-redux";
import authReducer from "./reducers/auth";
import playersReducer from "./reducers/players";

/**
 * L'utilisateur navigue entre Dashboard, Marché et Blessures.
 * Ces vues chargent leurs données en direct, sans passer par ce store.
 */
export const store = configureStore({
  reducer: {
    auth: authReducer, // gère l'état de l'utilisateur connecté (token, infos, etc.) soit l'authentification
    players: playersReducer, // gère l'état des joueurs (liste, détails, etc.) soit les données liées aux joueurs
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

/**
 * Un composant lit ou modifie l'état global (auth, joueurs).
 * Ces hooks typés remplacent useDispatch/useSelector partout dans l'app.
 */
export const useAppDispatch = useDispatch.withTypes<AppDispatch>();
export const useAppSelector = useSelector.withTypes<RootState>();
