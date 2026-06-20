import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { ErrorBoundary } from "./ui/ErrorBoundary";
import "./styles/tokens.css";
import "./styles/layout.css";
import "./styles/components.css";
import "./styles/typography.css";
import "./styles.css";
import "./styles/director.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary fallbackLabel="应用启动">
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
