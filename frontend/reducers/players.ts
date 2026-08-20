import { createAsyncThunk, createSlice, type PayloadAction } from "@reduxjs/toolkit";
import { callApi } from "../api";
import type { Player } from "../../shared/types";

interface PlayersState {
  /** Résultats de la dernière recherche. Alimente aussi la liste d'autocomplétion. */
  results: Player[];
  /** Fiche affichée par l'onglet Stats. null tant qu'aucun joueur n'a été ouvert. */
  selected: Player | null;
  loading: boolean;
  error: string | null;
}

const INITIAL_STATE: PlayersState = { results: [], selected: null, loading: false, error: null };

/** Recherche par nom de joueur ou d'équipe. Source : GET /api/players/search. */
export const searchPlayers = createAsyncThunk("players/search", async (query: string) => {
  const data = await callApi<{ players: Player[] }>(
    `/api/players/search?q=${encodeURIComponent(query)}`,
  );
  return data.players;
});

const playersSlice = createSlice({
  name: "players",
  initialState: INITIAL_STATE,
  reducers: {
    /** Ouvre une fiche : les résultats de recherche portent déjà toutes les stats. */
    playerSelected(state, action: PayloadAction<Player>) {
      state.selected = action.payload;
    },
    resultsCleared(state) {
      state.results = [];
    },
  },
  extraReducers(builder) {
    builder
      .addCase(searchPlayers.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(searchPlayers.fulfilled, (state, action: PayloadAction<Player[]>) => {
        state.results = action.payload;
        state.loading = false;
      })
      // Liste vide plutôt qu'un message : la frappe ne doit jamais être interrompue.
      .addCase(searchPlayers.rejected, (state, action) => {
        state.results = [];
        state.loading = false;
        state.error = action.error.message ?? "Recherche impossible";
      });
  },
});

export const { playerSelected, resultsCleared } = playersSlice.actions;
export default playersSlice.reducer;
