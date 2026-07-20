import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  base: "/la-vie-de-maia/",

  plugins: [
    VitePWA({
      registerType: "prompt",

      includeAssets: [
        "favicon.png",
      ],

      manifest: {
        name: "La vie de Maia",
        short_name: "Maia",
        description:
          "Journal personnel d’observations concernant Maia.",

        theme_color: "#080808",
        background_color: "#000000",

        display: "standalone",
        orientation: "portrait-primary",

        start_url: "./",
        scope: "./",

        lang: "fr",

        icons: [
          {
            src: "pwa-192x192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "pwa-maskable-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },

      devOptions: {
        enabled: true,
      },
    }),
  ],
});