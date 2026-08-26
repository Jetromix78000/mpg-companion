import { configureStore } from "@reduxjs/toolkit";
import { useDispatch, useSelector } from "react-redux";
import authReducer from "./reducers/auth";
import playersReducer from "./reducers/players";

// dashboard/transfers/injuries n'ont plus de reducer : DashboardView, MarketView
// et InjuriesView font leur propre fetch("/api/...") en local, sans passer par Redux.
export const store = configureStore({
  reducer: {
    auth: authReducer,
    players: playersReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

/** Versions typées des hooks react-redux, à utiliser partout dans l'application. */
export const useAppDispatch = useDispatch.withTypes<AppDispatch>();
export const useAppSelector = useSelector.withTypes<RootState>();
