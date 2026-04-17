/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        game: {
          bg: "#0a0a1a",
          card: "#12122a",
          border: "#1e1e4a",
          green: "#00ff88",
          cyan: "#00d4ff",
          purple: "#7c3aed",
          gold: "#f59e0b",
          red: "#ef4444",
          orange: "#f97316",
          yellow: "#eab308",
          text: "#e2e8f0",
          muted: "#64748b",
        },
      },
      fontFamily: {
        pixel: ['"Press Start 2P"', "cursive"],
        game: ['"Orbitron"', "sans-serif"],
        ui: ['"Inter"', "sans-serif"],
      },
      boxShadow: {
        "neon-green":
          "0 0 10px rgba(0,255,136,0.4), 0 0 30px rgba(0,255,136,0.2)",
        "neon-purple":
          "0 0 10px rgba(124,58,237,0.4), 0 0 30px rgba(124,58,237,0.2)",
        "neon-cyan":
          "0 0 10px rgba(0,212,255,0.4), 0 0 30px rgba(0,212,255,0.2)",
        "neon-gold":
          "0 0 10px rgba(245,158,11,0.4), 0 0 30px rgba(245,158,11,0.2)",
        "neon-red": "0 0 10px rgba(239,68,68,0.4), 0 0 30px rgba(239,68,68,0.2)",
      },
      animation: {
        "pulse-glow": "pulseGlow 2s ease-in-out infinite",
        "float-up": "floatUp 1s ease-out forwards",
        "bounce-in":
          "bounceIn 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards",
        shimmer: "shimmer 2s linear infinite",
      },
      keyframes: {
        pulseGlow: {
          "0%, 100%": { opacity: "0.8" },
          "50%": { opacity: "1" },
        },
        floatUp: {
          "0%": { opacity: "1", transform: "translateY(0) scale(1)" },
          "50%": { opacity: "1", transform: "translateY(-30px) scale(1.2)" },
          "100%": { opacity: "0", transform: "translateY(-60px) scale(0.8)" },
        },
        bounceIn: {
          "0%": { transform: "scale(0.3)", opacity: "0" },
          "50%": { transform: "scale(1.05)" },
          "70%": { transform: "scale(0.9)" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
      },
    },
  },
  plugins: [],
};
