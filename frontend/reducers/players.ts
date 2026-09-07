import { createAsyncThunk, createSlice, type PayloadAction } from "@reduxjs/toolkit";
import { callApi } from "../api";
import type { Player } from "../../shared/types";

interface PlayersState {
  /**
   * L'utilisateur tape une recherche.
   * Les résultats alimentent aussi la liste d'autocomplétion.
   */
  results: Player[];
  /**
   * L'utilisateur ouvre la fiche d'un joueur.
   * Elle reste ici, null tant qu'aucun joueur n'a été ouvert.
   */
  selected: Player | null;
  loading: boolean;
  error: string | null;
}

const INITIAL_STATE: PlayersState = { results: [], selected: null, loading: false, error: null };

/**
 * L'utilisateur tape un nom dans la barre de recherche.
 * Les joueurs correspondants (nom ou équipe) sont récupérés.
 */
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
    /**
     * L'utilisateur clique sur un résultat de recherche.
     * Sa fiche s'ouvre directement, les stats sont déjà là.
     */
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
      /**
       * La recherche de l'utilisateur échoue côté serveur.
       * La liste reste vide plutôt que d'interrompre sa frappe.
       */
      .addCase(searchPlayers.rejected, (state, action) => {
        state.results = [];
        state.loading = false;
        state.error = action.error.message ?? "Recherche impossible";
      });
  },
});

export const { playerSelected, resultsCleared } = playersSlice.actions;
export default playersSlice.reducer;
