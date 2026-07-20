import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  base: "/la-vie-de-maia/",

  plugins: [
    VitePWA({
      registerType: "autoUpdate",

      includeAssets: [
        "favicon.svg",
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
      },

      devOptions: {
        enabled: true,
      },
    }),
  ],
});