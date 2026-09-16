/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        "primary": "#001428",
        "primary-container": "#0f2942",
        "on-primary": "#ffffff",
        "on-primary-container": "#7991af",
        "primary-fixed": "#d1e4ff",
        "primary-fixed-dim": "#b0c9e8",
        "on-primary-fixed": "#011d35",
        "on-primary-fixed-variant": "#314863",
        "inverse-primary": "#b0c9e8",

        "secondary": "#545f73",
        "secondary-container": "#d5e0f8",
        "on-secondary": "#ffffff",
        "on-secondary-container": "#586377",
        "secondary-fixed": "#d8e3fb",
        "secondary-fixed-dim": "#bcc7de",
        "on-secondary-fixed": "#111c2d",
        "on-secondary-fixed-variant": "#3c475a",

        "tertiary": "#260b00",
        "tertiary-container": "#471a00",
        "on-tertiary": "#ffffff",
        "on-tertiary-container": "#ea6803",
        "tertiary-fixed": "#ffdbca",
        "tertiary-fixed-dim": "#ffb690",
        "on-tertiary-fixed": "#341100",
        "on-tertiary-fixed-variant": "#783200",

        "surface": "#f8f9ff",
        "surface-dim": "#cbdbf5",
        "surface-bright": "#f8f9ff",
        "surface-variant": "#d3e4fe",
        "surface-container-lowest": "#ffffff",
        "surface-container-low": "#eff4ff",
        "surface-container": "#e5eeff",
        "surface-container-high": "#dce9ff",
        "surface-container-highest": "#d3e4fe",
        "surface-tint": "#49607c",

        "on-surface": "#0b1c30",
        "on-surface-variant": "#43474d",
        "inverse-surface": "#213145",
        "inverse-on-surface": "#eaf1ff",

        "background": "#f8f9ff",
        "on-background": "#0b1c30",

        "outline": "#74777e",
        "outline-variant": "#c3c6ce",

        "error": "#ba1a1a",
        "error-container": "#ffdad6",
        "on-error": "#ffffff",
        "on-error-container": "#93000a",

        // Accent brand colors for Tuwshiuah
        "brand-orange": "#f97316",
        "brand-navy": "#0f2942",
        "brand-sky": "#0ea5e9",
        "brand-blue": "#0284c7"
      },
      borderRadius: {
        "DEFAULT": "0.25rem",
        "md": "0.5rem",
        "lg": "0.5rem",
        "xl": "0.75rem",
        "2xl": "1rem",
        "full": "9999px"
      },
      spacing: {
        "header-height": "4rem",
        "gutter-mobile": "1rem",
        "gutter-desktop": "1.5rem",
        "sidebar-width": "16.25rem",
        "sidebar-collapsed": "4.5rem",
        "space-2xs": "0.125rem",
        "space-xs": "0.25rem",
        "space-sm": "0.5rem",
        "space-md": "0.75rem",
        "space-lg": "1rem",
        "space-xl": "1.5rem",
        "space-2xl": "2rem",
        "space-3xl": "3rem"
      },
      fontFamily: {
        sans: ["Inter", "sans-serif"],
        headline: ["Plus Jakarta Sans", "sans-serif"],
        mono: ["Inter", "monospace"]
      }
    },
  },
  plugins: [],
}
