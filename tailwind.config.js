/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: [
    './src/**/*.{ts,tsx}',
    './src/sidepanel/**/*.{ts,tsx}',
    './src/sidepanel/v2/**/*.{ts,tsx}',
    './src/sidepanel/v2/components/**/*.{ts,tsx}',
    './src/sidepanel/components/ui/**/*.{ts,tsx}',
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        'background-alt': "hsl(var(--background-alt))",
        foreground: "hsl(var(--foreground))",
        brand: "hsl(var(--brand))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
      },
      keyframes: {
        "accordion-down": {
          from: { height: 0 },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: 0 },
        },
        "float": {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-10px)" },
        },
        "pulse-glow": {
          "0%, 100%": { 
            boxShadow: "0 0 20px rgba(255, 165, 0, 0.3)",
            opacity: "0.7"
          },
          "50%": { 
            boxShadow: "0 0 40px rgba(255, 165, 0, 0.6)",
            opacity: "1"
          },
          'paw-walk': {
            '0%': { transform: 'translate(0, 0) rotate(0deg)', opacity: '0' },
            '20%': { transform: 'translate(0, -1vw) rotate(5deg)', opacity: '1' },
                      '60%': { transform: 'translate(2vw, -0.5vw) rotate(3deg)', opacity: '0.7' },
          '100%': { transform: 'translate(3vw, 0) rotate(0deg)', opacity: '0' }
        },
        'paw-walk-trail': {
          '0%': { transform: 'scale(0.8) rotate(-5deg)', opacity: '0' },
          '20%': { transform: 'scale(1) rotate(0deg)', opacity: '0.9' },
          '40%': { transform: 'scale(0.95) rotate(3deg)', opacity: '0.7' },
          '60%': { transform: 'scale(0.9) rotate(1deg)', opacity: '0.5' },
          '80%': { transform: 'scale(0.8) rotate(-2deg)', opacity: '0.3' },
          '100%': { transform: 'scale(0.7) rotate(0deg)', opacity: '0' }
        },
        'paw-walk-trail-left': {
          '0%': { transform: 'scale(0.8) rotate(-8deg)', opacity: '0' },
          '20%': { transform: 'scale(1) rotate(-3deg)', opacity: '0.9' },
          '40%': { transform: 'scale(0.95) rotate(1deg)', opacity: '0.7' },
          '60%': { transform: 'scale(0.9) rotate(-1deg)', opacity: '0.5' },
          '80%': { transform: 'scale(0.8) rotate(-4deg)', opacity: '0.3' },
          '100%': { transform: 'scale(0.7) rotate(-2deg)', opacity: '0' }
        },
        'paw-walk-trail-right': {
          '0%': { transform: 'scale(0.8) rotate(8deg)', opacity: '0' },
          '20%': { transform: 'scale(1) rotate(3deg)', opacity: '0.9' },
          '40%': { transform: 'scale(0.95) rotate(-1deg)', opacity: '0.7' },
          '60%': { transform: 'scale(0.9) rotate(1deg)', opacity: '0.5' },
          '80%': { transform: 'scale(0.8) rotate(4deg)', opacity: '0.3' },
          '100%': { transform: 'scale(0.7) rotate(2deg)', opacity: '0' }
        }

        },
        "slide-in-right": {
          "0%": { transform: "translateX(100%)", opacity: "0" },
          "100%": { transform: "translateX(0)", opacity: "1" },
        },
        "slide-in-left": {
          "0%": { transform: "translateX(-100%)", opacity: "0" },
          "100%": { transform: "translateX(0)", opacity: "1" },
        },
        "fade-in-up": {
          "0%": { transform: "translateY(20px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        "drop-from-bottom": {
          "0%": { transform: "translateY(0)", opacity: "1" },
          "100%": { transform: "translateY(20px)", opacity: "0" },
        },
        "slide-in-from-top": {
          "0%": { transform: "translateY(-20px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        "shimmer": {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(100%)" }
        },
        "scale-in": {
          "0%": { 
            opacity: "0", 
            transform: "scale(0.95)" 
          },
          "100%": { 
            opacity: "1", 
            transform: "scale(1)" 
          }
        },
        "typing-dot": {
          "0%, 60%, 100%": { 
            transform: "translateY(0)" 
          },
          "30%": { 
            transform: "translateY(-6px)" 
          }
        },
        "slide-in-smooth": {
          "0%": {
            opacity: "0",
            transform: "translateY(8px) scale(0.98)"
          },
          "100%": {
            opacity: "1",
            transform: "translateY(0) scale(1)"
          }
        },
        "pulse-subtle": {
          "0%, 100%": { 
            opacity: "1", 
            transform: "scale(1)" 
          },
          "50%": { 
            opacity: "0.95", 
            transform: "scale(1.005)" 
          }
        },
        "list-cycle": {
          "0%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-60px)" },
          "51%": { transform: "translateY(0)" },
        },
        "list-move-down": {
          "0%": { transform: "translateY(0)" },
          "100%": { transform: "translateY(-60px)" },
        },
        "list-slide-in": {
          "0%": { transform: "translateY(-60px)" },
          "100%": { transform: "translateY(0)" },
        },
        "brand-glow": {
          "0%, 100%": { 
            boxShadow: "0 0 10px rgba(255, 165, 0, 0.3)",
            borderColor: "hsl(19, 96%, 55%)"
          },
          "50%": { 
            boxShadow: "0 0 20px rgba(255, 165, 0, 0.6)",
            borderColor: "hsl(19, 96%, 65%)"
          },
        },
        "moving-light": {
          "0%": { 
            transform: "translateX(-100%) rotate(45deg)",
            opacity: "0"
          },
          "20%": { 
            opacity: "0.8"
          },
          "80%": { 
            opacity: "0.8"
          },
          "100%": { 
            transform: "translateX(200%) rotate(45deg)",
            opacity: "0"
          },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "float": "float 3s ease-in-out infinite",
        "pulse-glow": "pulse-glow 2s ease-in-out infinite",
        "slide-in-right": "slide-in-right 0.5s ease-out",
        "slide-in-left": "slide-in-left 0.5s ease-out",
        "fade-in-up": "fade-in-up 0.6s ease-out",
        "brand-glow": "brand-glow 2s ease-in-out infinite",
        "moving-light": "moving-light 4s ease-in-out infinite",
        "drop-from-bottom": "drop-from-bottom 0.3s ease-out",
        "slide-in-from-top": "slide-in-from-top 0.3s ease-out",
        "list-cycle": "list-cycle 3s ease-in-out infinite",
        "list-move-down": "list-move-down 0.3s ease-out",
        "list-slide-in": "list-slide-in 0.3s ease-out",
        'paw-walk': 'paw-walk 1.5s ease-in-out forwards',
        'paw-walk-trail': 'paw-walk-trail 2s ease-in-out forwards',
        'paw-walk-trail-left': 'paw-walk-trail-left 2s ease-in-out forwards',
        'paw-walk-trail-right': 'paw-walk-trail-right 2s ease-in-out forwards',
        "shimmer": "shimmer 2s infinite",
        "scale-in": "scale-in 0.3s ease-out",
        "typing-dot": "typing-dot 1.4s ease-in-out infinite",
        "slide-in-smooth": "slide-in-smooth 0.3s cubic-bezier(0.4, 0.0, 0.2, 1)",
        "pulse-subtle": "pulse-subtle 2s ease-in-out infinite"
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} 