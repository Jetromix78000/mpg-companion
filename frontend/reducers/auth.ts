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
  /**
   * L'utilisateur recharge le site avec un token en localStorage.
   * loading reste vrai tant que la vérification de session n'a pas répondu.
   */
  loading: boolean;
  isLoginOpen: boolean;
}

/**
 * L'utilisateur navigue en mode privé, où localStorage peut lever une erreur.
 * L'échec est absorbé, aucun token n'est restauré.
 */
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
    /**
     * L'utilisateur recharge la page sans que le token ait pu être stocké.
     * Il devra se reconnecter, la session n'a pas persisté.
     */
  }
}

const storedToken = readStoredToken();

const INITIAL_STATE: AuthState = {
  user: null,
  token: storedToken,
  loading: Boolean(storedToken),
  isLoginOpen: false,
};

interface AuthResponse {
  user: AuthUser;
  token: string;
}

/**
 * L'utilisateur ouvre l'application avec un token en localStorage.
 * Son profil est revérifié auprès du serveur.
 */
export const fetchSession = createAsyncThunk("auth/fetchSession", async (_arg, { getState }) => {
  const token = (getState() as { auth: AuthState }).auth.token;
  if (!token) return null;

  const data = await callApi<{ user: AuthUser | null }>("/api/auth/session", { token });
  return data.user;
});

/**
 * L'utilisateur clique sur se déconnecter.
 * Son token est vidé côté serveur, puis effacé localement dans tous les cas.
 */
export const logout = createAsyncThunk("auth/logout", async (_arg, { getState }) => {
  const token = (getState() as { auth: AuthState }).auth.token;

  try {
    await callApi("/api/auth/logout", { method: "POST", token });
  } catch {
    /**
     * Le token était déjà invalide côté serveur.
     * La déconnexion locale reste appliquée malgré l'erreur.
     */
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
     * L'utilisateur valide le formulaire de connexion ou d'inscription.
     * Sa session s'ouvre et la modale se referme aussitôt.
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
      /**
       * Le token de l'utilisateur est périmé ou le serveur est injoignable.
       * Il repasse proprement en déconnecté.
       */
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
