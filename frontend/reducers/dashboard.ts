import { createAsyncThunk, createSlice, type PayloadAction } from "@reduxjs/toolkit";
import { callApi } from "../api";
import type { Player } from "../../shared/types";

interface DashboardState {
  topPlayers: Player[];
  loading: boolean;
  error: string | null;
}

const INITIAL_STATE: DashboardState = { topPlayers: [], loading: false, error: null };

/** Joueurs mis en avant sur le tableau de bord. Source : GET /api/dashboard. */
export const loadDashboard = createAsyncThunk("dashboard/load", async () => {
  const data = await callApi<{ topPlayers: Player[] }>("/api/dashboard");
  return data.topPlayers;
});

const dashboardSlice = createSlice({
  name: "dashboard",
  initialState: INITIAL_STATE,
  reducers: {},
  extraReducers(builder) {
    builder
      .addCase(loadDashboard.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(loadDashboard.fulfilled, (state, action: PayloadAction<Player[]>) => {
        state.topPlayers = action.payload;
        state.loading = false;
      })
      .addCase(loadDashboard.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message ?? "Chargement impossible";
      });
  },
});

export default dashboardSlice.reducer;
