import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  // Agent worktrees live under .claude/ - never collect their test copies.
  test: { exclude: ["**/node_modules/**", "**/dist/**", ".claude/**"] },
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      // Registered from src/main.jsx via `virtual:pwa-register`; this
      // plugin's generated sw.js is the app's only service worker.
      injectRegister: false,
      includeAssets: ["favicon.svg", "icons/icon-192.png", "icons/icon-512.png"],
      manifest: {
        name: "Forge Coach",
        short_name: "Forge",
        description: "Personal training coaching app by Denis",
        theme_color: "#050505",
        background_color: "#050505",
        display: "standalone",
        orientation: "portrait",
        start_url: "/",
        scope: "/",
        icons: [
          {
            src: "/icons/icon-192.png",
            sizes: "192x192",
            type: "image/png"
          },
          {
            src: "/icons/icon-512.png",
            sizes: "512x512",
            type: "image/png"
          }
        ]
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg}"],
        cleanupOutdatedCaches: true,
        // Take over open tabs on deploy; src/main.jsx reloads once on
        // `controllerchange` so a tab never mixes old JS with a new worker.
        skipWaiting: true,
        clientsClaim: true,
        // SPA navigations fall back to the precached index.html, except the
        // Worker API, which must always reach the network.
        navigateFallbackDenylist: [/^\/api\//],
        // Never cache any /api/* response (auth, data, payments, AI).
        runtimeCaching: [
          {
            urlPattern: ({ url, sameOrigin }) => sameOrigin && url.pathname.startsWith("/api/"),
            handler: "NetworkOnly"
          }
        ]
      }
    })
  ]
});
