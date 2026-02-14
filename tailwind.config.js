/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      keyframes: {
        "msg-enter": {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        blink: {
          "50%": { opacity: "0" },
        },
        "dot-bounce": {
          "0%, 80%, 100%": { opacity: "0.3", transform: "scale(0.8)" },
          "40%": { opacity: "1", transform: "scale(1)" },
        },
        "pulse-border": {
          "0%, 100%": { borderColor: "#d9d9d9" },
          "50%": { borderColor: "#a0a0a0" },
        },
      },
      animation: {
        "msg-enter": "msg-enter 0.2s ease-out",
        blink: "blink 1s step-end infinite",
        "dot-bounce": "dot-bounce 1.4s ease-in-out infinite",
        "pulse-border": "pulse-border 2s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
