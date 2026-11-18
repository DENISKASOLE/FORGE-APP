import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg", "icons/*.png", "splash/mark-*.png"],
      manifest: {
        id: "/",
        name: "Forge Coach",
        short_name: "Forge",
        description: "Personal training coaching app by Denis",
        theme_color: "#0E5E5A",
        background_color: "#F5F2EC",
        display: "standalone",
        display_override: ["standalone"],
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
          },
          {
            src: "/icons/icon-maskable-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable"
          }
        ]
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
        globIgnores: ["**/splash/light-*.png", "**/splash/dark-*.png"],
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
        navigateFallbackDenylist: [/^\/authorize/, /^\/token/, /^\/register/, /^\/mcp/, /^\/\.well-known\//],
        // Offline (Nov 2026): pictures the app has shown once stay on the
        // phone - exercise video thumbnails and client photos/avatars from
        // Supabase Storage. Signed photo links change their token on every
        // load, so the token is ignored when matching a saved copy.
        runtimeCaching: [
          {
            urlPattern: ({ url }) => /(^|\.)ytimg\.com$|^img\.youtube\.com$/.test(url.hostname),
            handler: "CacheFirst",
            options: { cacheName: "forge-video-thumbs", expiration: { maxEntries: 400, maxAgeSeconds: 60 * 24 * 3600 }, cacheableResponse: { statuses: [0, 200] } },
          },
          {
            urlPattern: ({ url }) => url.pathname.startsWith("/storage/v1/object/") && /\.(supabase\.co|supabase\.in)$/.test(url.hostname),
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "forge-photos",
              expiration: { maxEntries: 300, maxAgeSeconds: 60 * 24 * 3600 },
              cacheableResponse: { statuses: [0, 200] },
              plugins: [{ cacheKeyWillBeUsed: async ({ request }) => { const u = new URL(request.url); u.searchParams.delete("token"); return u.href; } }],
            },
          },
        ]
      }
    })
  ]
});