import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },

  // Web Worker configuration.
  // format: "es" matches the { type: "module" } option in new Worker(...) in useNow.ts.
  // This enables TypeScript and ES module imports inside the worker file.
  worker: {
    format: "es",
  },

  build: {
    rollupOptions: {
      output: {
        // Split large dependencies into separate chunks. This reduces the initial
        // JS bundle size and therefore the memory Chrome must allocate on page load —
        // directly reducing the likelihood of the "Aw Snap" tab kill.
        manualChunks: {
          "bible-data": ["./src/lib/bible-verses"],  // 5.5MB — biggest offender
          "motion": ["framer-motion"],
          "charts": ["recharts"],
        },
      },
    },
  },
}));
