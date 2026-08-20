import { configureStore } from "@reduxjs/toolkit";
import { useDispatch, useSelector } from "react-redux";
import authReducer from "./reducers/auth";
import dashboardReducer from "./reducers/dashboard";
import injuriesReducer from "./reducers/injuries";
import playersReducer from "./reducers/players";
import transfersReducer from "./reducers/transfers";

// Un reducer par fonctionnalité du MVP : connexion, tableau de bord, marché,
// stats joueurs (+ recherche), blessures.
export const store = configureStore({
  reducer: {
    auth: authReducer,
    dashboard: dashboardReducer,
    transfers: transfersReducer,
    players: playersReducer,
    injuries: injuriesReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

/** Versions typées des hooks react-redux, à utiliser partout dans l'application. */
export const useAppDispatch = useDispatch.withTypes<AppDispatch>();
export const useAppSelector = useSelector.withTypes<RootState>();
