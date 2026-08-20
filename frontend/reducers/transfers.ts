import { createAsyncThunk, createSlice, type PayloadAction } from "@reduxjs/toolkit";
import { callApi } from "../api";
import type { TransferMovement } from "../../shared/types";

interface TransfersState {
  items: TransferMovement[];
  loading: boolean;
  error: string | null;
}

const INITIAL_STATE: TransfersState = { items: [], loading: false, error: null };

/** Marché des transferts. Source : GET /api/transfers. */
export const loadTransfers = createAsyncThunk("transfers/load", async () => {
  const data = await callApi<{ transfers: TransferMovement[] }>("/api/transfers");
  return data.transfers;
});

const transfersSlice = createSlice({
  name: "transfers",
  initialState: INITIAL_STATE,
  reducers: {},
  extraReducers(builder) {
    builder
      .addCase(loadTransfers.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(loadTransfers.fulfilled, (state, action: PayloadAction<TransferMovement[]>) => {
        state.items = action.payload;
        state.loading = false;
      })
      .addCase(loadTransfers.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message ?? "Chargement impossible";
      });
  },
});

export default transfersSlice.reducer;
