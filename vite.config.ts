import { cloudflare } from "@cloudflare/vite-plugin";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig(({ mode }) => {
  const base = mode === "github-pages" ? "/syd-guide/" : "/";

  return {
    base,
    plugins: [
      react(),
      ...(mode === "github-pages" ? [] : [cloudflare()]),
      VitePWA({
        registerType: "autoUpdate",
        manifest: {
          name: "둘만의 여행 가이드북",
          short_name: "여행 가이드",
          lang: "ko",
          display: "standalone",
          start_url: base,
          scope: base,
          background_color: "#f7f3ea",
          theme_color: "#0b6b67",
          icons: [
            {
              src: `${base}icons/icon-192.png`,
              sizes: "192x192",
              type: "image/png"
            },
            {
              src: `${base}icons/icon-512.png`,
              sizes: "512x512",
              type: "image/png"
            }
          ]
        },
        workbox: {
          globPatterns: ["**/*.{js,css,html,png,svg,woff2}"],
          runtimeCaching: [
            {
              urlPattern: ({ url }) => url.pathname.startsWith("/api/"),
              handler: "NetworkOnly"
            }
          ]
        }
      })
    ]
  };
});
