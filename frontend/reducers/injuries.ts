import { createAsyncThunk, createSlice, type PayloadAction } from "@reduxjs/toolkit";
import { callApi } from "../api";
import type { InjuryItem } from "../../shared/types";

interface InjuriesPayload {
  injuries: InjuryItem[];
  /** Clubs sélectionnables dans le filtre. "Tous les clubs" est en tête. */
  clubs: string[];
}

interface InjuriesState extends InjuriesPayload {
  loading: boolean;
  error: string | null;
}

const INITIAL_STATE: InjuriesState = {
  injuries: [],
  clubs: [],
  loading: false,
  error: null,
};

/** Centre des blessures. Source : GET /api/injuries. */
export const loadInjuries = createAsyncThunk("injuries/load", () =>
  callApi<InjuriesPayload>("/api/injuries"),
);

const injuriesSlice = createSlice({
  name: "injuries",
  initialState: INITIAL_STATE,
  reducers: {},
  extraReducers(builder) {
    builder
      .addCase(loadInjuries.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(loadInjuries.fulfilled, (state, action: PayloadAction<InjuriesPayload>) => {
        state.injuries = action.payload.injuries;
        state.clubs = action.payload.clubs;
        state.loading = false;
      })
      .addCase(loadInjuries.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message ?? "Chargement impossible";
      });
  },
});

export default injuriesSlice.reducer;
