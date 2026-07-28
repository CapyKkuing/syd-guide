import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app/App";
import { consumePairTokenFromUrl } from "./app/router";
import "./styles/tokens.css";
import "./styles/base.css";
import "./styles/components.css";
import "./styles/layout.css";
import "./styles/library.css";
import "./styles/navigation.css";
import "./styles/pairing.css";
import "./styles/today.css";
import "./styles/schedule.css";
import "./styles/map.css";
import "./styles/tools.css";

const pairToken = consumePairTokenFromUrl();
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App pairToken={pairToken} />
  </StrictMode>
);
