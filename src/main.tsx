import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app/App";
import { consumePairTokenFromUrl } from "./app/router";
import "./styles/tokens.css";
import "./styles/base.css";
import "./styles/components.css";
import "./styles/navigation.css";
import "./styles/pairing.css";

const pairToken = consumePairTokenFromUrl();
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App pairToken={pairToken} />
  </StrictMode>
);
