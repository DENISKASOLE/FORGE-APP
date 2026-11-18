import "@fontsource-variable/inter";
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
  navigator.serviceWorker.register("/sw.js").then((reg) => {
    // Native apps update in the background; a home-screen web app only
    // checks when it's fully restarted. Check every time the app comes back
    // to the foreground (and hourly while open) so a new deploy is picked
    // up without the client having to close and reopen it.
    document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") reg.update().catch(() => {}); });
    setInterval(() => reg.update().catch(() => {}), 60 * 60 * 1000);
  });
  // The new worker takes over (skipWaiting + clientsClaim) and we reload
  // once so the page never runs old JS against a new worker. To avoid
  // yanking the screen from under someone mid-task, reload right away only
  // if the app is in the background or was just reopened (first few
  // seconds); otherwise wait until they next leave the app.
  let refreshing = false;
  let shownAt = Date.now();
  let pending = false;
  const reload = () => { if (refreshing) return; refreshing = true; window.location.reload(); };
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") shownAt = Date.now();
    else if (pending) reload();
  });
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (document.visibilityState !== "visible" || Date.now() - shownAt < 6000) reload();
    else pending = true;
  });
}
