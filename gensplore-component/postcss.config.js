import tailwindcss from "@tailwindcss/postcss";
import prefixSelector from "postcss-prefix-selector";

export default {
  plugins: [
    tailwindcss(),
    // Include resets and utilities, but never restyle the embedding application.
    prefixSelector({
      prefix: ".gensplore",
      transform(prefix, selector, prefixedSelector) {
        if (selector === ":root" || selector === ":host" || selector === "html" || selector === "body") return prefix;
        if (selector.startsWith(".") || selector === "*") {
          return `${prefix}${selector === "*" ? "" : selector}, ${prefixedSelector}`;
        }
        return prefixedSelector;
      },
    }),
  ],
};
