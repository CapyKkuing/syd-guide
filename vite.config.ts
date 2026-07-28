import { cloudflare } from "@cloudflare/vite-plugin";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import type { Plugin } from "vite";
import { VitePWA } from "vite-plugin-pwa";

function pagesSpaFallback(): Plugin {
  return {
    name: "pages-spa-fallback",
    apply: "build",
    generateBundle: {
      order: "post",
      handler(_options, bundle) {
        const index = bundle["index.html"];
        if (!index || index.type !== "asset") {
          this.error("GitHub Pages fallback requires the built index.html asset");
        }
        this.emitFile({
          type: "asset",
          fileName: "404.html",
          source: index.source
        });
      }
    }
  };
}

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
          background_color: "#F4F2EA",
          theme_color: "#376C4A",
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
      }),
      ...(mode === "github-pages" ? [pagesSpaFallback()] : [])
    ]
  };
});
