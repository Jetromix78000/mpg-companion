import { createAsyncThunk, createSlice, type PayloadAction } from "@reduxjs/toolkit";
import { callApi } from "../api";

const TOKEN_KEY = "mpg:token";

export interface AuthUser {
  id: string;
  email: string;
  displayName: string | null;
}

interface AuthState {
  user: AuthUser | null;
  token: string | null;
  /** true tant que la première vérification de session n'a pas répondu */
  loading: boolean;
  isLoginOpen: boolean;
}

/** localStorage lève en navigation privée sur certains navigateurs : on encaisse. */
function readStoredToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function storeToken(token: string | null): void {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Session non persistée : l'utilisateur devra se reconnecter au rechargement.
  }
}

const storedToken = readStoredToken();

const INITIAL_STATE: AuthState = {
  user: null,
  token: storedToken,
  // On ne fait patienter l'interface que s'il y a un token à vérifier.
  loading: Boolean(storedToken),
  isLoginOpen: false,
};

interface AuthResponse {
  user: AuthUser;
  token: string;
}

/** Relit l'utilisateur du token présent en localStorage, au démarrage de l'application. */
export const fetchSession = createAsyncThunk("auth/fetchSession", async (_arg, { getState }) => {
  const token = (getState() as { auth: AuthState }).auth.token;
  if (!token) return null;

  const data = await callApi<{ user: AuthUser | null }>("/api/auth/session", { token });
  return data.user;
});

/** Vide le token côté serveur, puis nettoie localement quoi qu'il arrive. */
export const logout = createAsyncThunk("auth/logout", async (_arg, { getState }) => {
  const token = (getState() as { auth: AuthState }).auth.token;

  try {
    await callApi("/api/auth/logout", { method: "POST", token });
  } catch {
    // Token déjà invalide côté serveur : la déconnexion locale reste le bon résultat.
  }
  storeToken(null);
});

const authSlice = createSlice({
  name: "auth",
  initialState: INITIAL_STATE,
  reducers: {
    loginRequested(state) {
      state.isLoginOpen = true;
    },
    loginDismissed(state) {
      state.isLoginOpen = false;
    },
    /**
     * Pose la session après un signup/signin fait par le composant (fetch direct,
     * pas de thunk) et referme la modale en une seule transition.
     */
    sessionStarted(state, action: PayloadAction<AuthResponse>) {
      state.user = action.payload.user;
      state.token = action.payload.token;
      state.isLoginOpen = false;
      state.loading = false;
    },
  },
  extraReducers(builder) {
    builder
      .addCase(fetchSession.fulfilled, (state, action: PayloadAction<AuthUser | null>) => {
        state.user = action.payload;
        state.loading = false;
      })
      // Token périmé ou serveur injoignable : on repart proprement en déconnecté.
      .addCase(fetchSession.rejected, (state) => {
        storeToken(null);
        state.user = null;
        state.token = null;
        state.loading = false;
      })
      .addCase(logout.fulfilled, (state) => {
        state.user = null;
        state.token = null;
      });
  },
});

export const { loginRequested, loginDismissed, sessionStarted } = authSlice.actions;
export default authSlice.reducer;
