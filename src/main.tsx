import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import {AuthProvider} from './auth/AuthContext';
import {LoginModal} from './auth/LoginModal';
import {FavoritesProvider} from './favorites/FavoritesContext';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <FavoritesProvider>
        <App />
        <LoginModal />
      </FavoritesProvider>
    </AuthProvider>
  </StrictMode>,
);
