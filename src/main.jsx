import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "./styles/global.css";
import App from "./App.jsx";
import { ErrorBoundary } from "./components/ErrorBoundary.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>
);

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/sw.js");
  // The generated service worker takes over active tabs on every deploy
  // (skipWaiting + clientsClaim), which otherwise leaves an already-open
  // tab running old JS against a new worker - a real source of the "app
  // just closes" reports, since any mismatch between the two can throw.
  // Reloading once when control actually changes keeps a client always on
  // one consistent, fully-loaded version instead of a stale in-between one.
  // The `refreshing` guard matters because "controllerchange" can fire more
  // than once per page life (e.g. a second update arriving before this
  // reload finishes) - without it a slow reload could restart and loop.
  let refreshing = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (refreshing) return;
    refreshing = true;
    window.location.reload();
  });
}
