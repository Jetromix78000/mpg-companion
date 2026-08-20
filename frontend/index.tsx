import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Provider } from "react-redux";
import App from "./App.tsx";
import { LoginModal } from "./auth/LoginModal";
import { SessionRestorer } from "./SessionRestorer";
import { store } from "./store";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Provider store={store}>
      <SessionRestorer />
      <App />
      <LoginModal />
    </Provider>
  </StrictMode>,
);
