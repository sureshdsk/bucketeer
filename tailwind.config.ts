import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";

function v(name: string) {
  return `var(--${name})`;
}

export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        border: v("border"),
        input: v("input"),
        ring: v("ring"),
        background: v("background"),
        foreground: v("foreground"),
        primary: {
          DEFAULT: v("primary"),
          foreground: v("primary-foreground"),
        },
        secondary: {
          DEFAULT: v("secondary"),
          foreground: v("secondary-foreground"),
        },
        destructive: {
          DEFAULT: v("destructive"),
          foreground: v("destructive-foreground"),
        },
        muted: {
          DEFAULT: v("muted"),
          foreground: v("muted-foreground"),
        },
        accent: {
          DEFAULT: v("accent"),
          foreground: v("accent-foreground"),
        },
        popover: {
          DEFAULT: v("popover"),
          foreground: v("popover-foreground"),
        },
        card: {
          DEFAULT: v("card"),
          foreground: v("card-foreground"),
        },

        "surface-dim": v("surface-dim"),
        "surface-bright": v("surface-bright"),
        "surface-container-lowest": v("surface-container-lowest"),
        "surface-container-low": v("surface-container-low"),
        "surface-container": v("surface-container"),
        "surface-container-high": v("surface-container-high"),
        "surface-container-highest": v("surface-container-highest"),
        "on-surface": v("on-surface"),
        "on-surface-variant": v("on-surface-variant"),
        outline: v("outline"),
        "outline-variant": v("outline-variant"),
        "surface-tint": v("surface-tint"),
        "primary-container": v("primary-container"),
        "on-primary-container": v("on-primary-container"),
        "secondary-container": v("secondary-container"),
        "on-secondary": v("on-secondary"),
        "secondary-fixed": v("secondary-fixed"),
        "secondary-fixed-dim": v("secondary-fixed-dim"),
        "error-container": v("error-container"),
        "on-error-container": v("on-error-container"),

        "tint-blue": v("tint-blue"),
        "tint-amber": v("tint-amber"),
        "tint-green": v("tint-green"),
        "tint-rose": v("tint-rose"),
        "tint-violet": v("tint-violet"),
        "tint-on-blue": v("tint-on-blue"),
        "tint-on-amber": v("tint-on-amber"),
        "tint-on-green": v("tint-on-green"),
        "tint-on-rose": v("tint-on-rose"),
        "tint-on-violet": v("tint-on-violet"),
      },
      borderRadius: {
        sm: "0.25rem",
        DEFAULT: "0.375rem",
        md: "0.5rem",
        lg: "0.625rem",
        xl: "0.75rem",
        "2xl": "1rem",
        "3xl": "1.25rem",
        full: "9999px",
        card: v("radius-card"),
        "card-lg": v("radius-card-lg"),
        pill: v("radius-pill"),
      },
      boxShadow: {
        sm: v("shadow-sm"),
        md: v("shadow-md"),
        lg: v("shadow-lg"),
        card: v("shadow-card"),
        "card-hover": v("shadow-card-hover"),
        floating: v("shadow-floating"),
        "focus-ring": v("focus-ring"),
      },
      fontFamily: {
        sans: ["Inter Variable", "Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: [
          "JetBrains Mono Variable",
          "JetBrains Mono",
          "ui-monospace",
          "monospace",
        ],
        "data-mono": [
          "JetBrains Mono Variable",
          "JetBrains Mono",
          "ui-monospace",
          "monospace",
        ],
      },
      fontSize: {
        "display-md": ["28px", { lineHeight: "36px", letterSpacing: "-0.025em" }],
        "display-sm": ["22px", { lineHeight: "28px", letterSpacing: "-0.02em" }],
        "headline-lg": ["20px", { lineHeight: "26px", letterSpacing: "-0.015em" }],
        "headline-sm": ["16px", { lineHeight: "22px", letterSpacing: "-0.01em" }],
        "body-md": ["13px", { lineHeight: "20px" }],
        "data-mono": ["12.5px", { lineHeight: "18px" }],
        "label-xs": ["10.5px", { lineHeight: "14px" }],
      },
      spacing: {
        sidebar_width: "248px",
        drawer_width: "380px",
        drawer_width_wide: "min(94vw, 1600px)",
        chrome_height: "52px",
        table_row: "40px",
        padding_tight: "8px",
        padding_base: "16px",
        card_padding: "16px",
        card_padding_lg: "20px",
        gutter: "1px",
      },
      transitionTimingFunction: {
        standard: v("ease-standard"),
        emphasized: v("ease-emphasized"),
        "out-soft": v("ease-out-soft"),
        spring: v("ease-spring"),
      },
      transitionDuration: {
        instant: v("duration-instant"),
        fast: v("duration-fast"),
        base: v("duration-base"),
        moderate: v("duration-moderate"),
        slow: v("duration-slow"),
      },
    },
  },
  plugins: [tailwindcssAnimate],
} satisfies Config;
