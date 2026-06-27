/* eslint-disable no-undef, @typescript-eslint/no-require-imports */
/**
 * Design-system source of truth for class names.
 *
 * Color tokens are defined as space-separated RGB channels in `global.css`
 * (`:root` = light, `.dark` = dark) and referenced here through
 * `rgb(var(--token) / <alpha-value>)` so every utility supports opacity and
 * automatically flips with the active color scheme.
 */
const colorToken = (name) => `rgb(var(--${name}) / <alpha-value>)`;

/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
    "./features/**/*.{js,jsx,ts,tsx}",
    "./lib/**/*.{js,jsx,ts,tsx}",
    "./theme/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        background: colorToken("background"),
        foreground: colorToken("foreground"),
        card: {
          DEFAULT: colorToken("card"),
          foreground: colorToken("card-foreground"),
        },
        popover: {
          DEFAULT: colorToken("popover"),
          foreground: colorToken("popover-foreground"),
        },
        primary: {
          DEFAULT: colorToken("primary"),
          foreground: colorToken("primary-foreground"),
        },
        secondary: {
          DEFAULT: colorToken("secondary"),
          foreground: colorToken("secondary-foreground"),
        },
        accent: {
          DEFAULT: colorToken("accent"),
          foreground: colorToken("accent-foreground"),
        },
        muted: {
          DEFAULT: colorToken("muted"),
          foreground: colorToken("muted-foreground"),
        },
        success: {
          DEFAULT: colorToken("success"),
          foreground: colorToken("success-foreground"),
        },
        warning: {
          DEFAULT: colorToken("warning"),
          foreground: colorToken("warning-foreground"),
        },
        danger: {
          DEFAULT: colorToken("danger"),
          foreground: colorToken("danger-foreground"),
        },
        coral: {
          DEFAULT: colorToken("coral"),
          foreground: colorToken("coral-foreground"),
        },
        lavender: {
          DEFAULT: colorToken("lavender"),
          foreground: colorToken("lavender-foreground"),
        },
        border: colorToken("border"),
        input: colorToken("input"),
        ring: colorToken("ring"),
      },
      borderRadius: {
        sm: "8px",
        DEFAULT: "12px",
        md: "12px",
        lg: "16px",
        xl: "20px",
        "2xl": "28px",
        "3xl": "36px",
      },
      fontFamily: {
        sans: ["Plus Jakarta Sans", "System", "ui-sans-serif", "sans-serif"],
        display: ["Plus Jakarta Sans", "System", "ui-sans-serif", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      fontSize: {
        xs: ["12px", { lineHeight: "16px" }],
        sm: ["14px", { lineHeight: "20px" }],
        base: ["16px", { lineHeight: "24px" }],
        lg: ["18px", { lineHeight: "26px" }],
        xl: ["20px", { lineHeight: "28px" }],
        "2xl": ["24px", { lineHeight: "32px" }],
        "3xl": ["30px", { lineHeight: "36px" }],
        "4xl": ["36px", { lineHeight: "42px" }],
        "5xl": ["48px", { lineHeight: "52px" }],
      },
      spacing: {
        18: "72px",
        22: "88px",
      },
      boxShadow: {
        card: "0 12px 32px -16px rgb(26 29 42 / 0.12)",
        "card-hover": "0 16px 40px -12px rgb(26 29 42 / 0.18)",
        push: "0 4px 0 0 rgb(26 29 42 / 0.15)",
      },
    },
  },
  plugins: [],
};
