import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
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
        // forge-mcp's OAuth endpoints (DECISIONS.md "forge-mcp") live on
        // this same origin via vercel.json rewrites. Workbox's generated
        // service worker otherwise registers an unrestricted
        // NavigationRoute that serves the cached app shell for ANY
        // navigation - including /authorize - which is exactly what
        // broke Claude's sign-in flow: a phone with this worker already
        // installed from ordinary app use opened /authorize and got the
        // Forge app's own dashboard instead of the OAuth login page.
        // navigateFallback must be set explicitly alongside the denylist -
        // generateSW only wires NavigationRoute's denylist when both are
        // given together, confirmed by inspecting the built sw.js (the
        // denylist alone produced an unrestricted NavigationRoute with no
        // denylist args at all).
        navigateFallback: "index.html",
        navigateFallbackDenylist: [/^\/authorize/, /^\/token/, /^\/register/, /^\/mcp/, /^\/\.well-known\//]
      }
    })
  ]
});