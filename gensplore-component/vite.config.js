import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import cssInjectedByJsPlugin from "vite-plugin-css-injected-by-js";
import { esmExternalRequirePlugin } from "rolldown/plugins";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);

export default defineConfig({
  plugins: [
    react(),
    cssInjectedByJsPlugin({
      injectCodeFunction: function (css) {
        if (typeof document === "undefined" || document.getElementById("gensplore-styles")) return;
        const style = document.createElement("style");
        style.id = "gensplore-styles";
        const nonce = document.querySelector('meta[property="csp-nonce"]')?.content;
        if (nonce) style.nonce = nonce;
        style.appendChild(document.createTextNode(css));
        document.head.appendChild(style);
      },
    }),
  ],
  resolve: { alias: { events: require.resolve("events/") } },
  worker: { format: "es" },
  build: {
    copyPublicDir: false,
    lib: {
      entry: "src/index.js",
      formats: ["es", "cjs"],
      fileName: (format) => format === "es" ? "gensplore.js" : "gensplore.cjs",
      cssFileName: "gensplore",
    },
    rolldownOptions: {
      // Dependencies contain CJS React imports; convert these for browser/SSR ESM consumers.
      plugins: [esmExternalRequirePlugin({ external: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "react-dom/client"] })],
    },
  },
});
