import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
export default defineConfig({
    plugins: [
        react(),
        VitePWA({
            registerType: "autoUpdate",
            includeAssets: ["icon.svg"],
            manifest: {
                name: "Offline Activity Tracker",
                short_name: "Tracker",
                description: "Offline-first personal activity timer and history tracker.",
                theme_color: "#136f63",
                background_color: "#f7f4ef",
                display: "standalone",
                start_url: "/",
                icons: [
                    {
                        src: "/icon.svg",
                        sizes: "any",
                        type: "image/svg+xml",
                        purpose: "any maskable"
                    }
                ]
            },
            workbox: {
                globPatterns: ["**/*.{js,css,html,svg,png,ico,woff2}"]
            },
            devOptions: {
                enabled: false
            }
        })
    ],
    test: {
        environment: "jsdom",
        setupFiles: ["./src/test/setup.ts"]
    }
});
