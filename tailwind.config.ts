import type { Config } from "tailwindcss";

// Brand colours come from CSS variables in src/app/globals.css
// Change them there (or in src/lib/brand.ts notes) to re-theme the whole app.
const v = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: v("brand-50"), 100: v("brand-100"), 200: v("brand-200"),
          500: v("brand-500"), 600: v("brand-600"), 700: v("brand-700"), 900: v("brand-900"),
          DEFAULT: v("brand-600"),
        },
        accent: { DEFAULT: v("accent"), dark: v("accent-dark") },
      },
      fontFamily: { sans: ["var(--font-sans)", "system-ui", "sans-serif"] },
      boxShadow: { card: "0 1px 2px rgb(0 0 0 / .05), 0 4px 16px rgb(15 40 80 / .06)" },
    },
  },
  plugins: [],
} satisfies Config;
