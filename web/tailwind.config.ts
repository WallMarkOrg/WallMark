import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // BNB-inspired palette
        bnb: {
          gold: '#F0B90B',
          dark: '#0B0E11',
        },
        surface: {
          DEFAULT: '#13131A',
          raised: '#1A1A27',
          border: '#2A2A3D',
        },
        brand: {
          DEFAULT: '#F5A623',
          dim: '#C4821A',
          glow: 'rgba(245,166,35,0.15)',
        },
        status: {
          funded: '#3B82F6',
          proof: '#8B5CF6',
          approved: '#10B981',
          rejected: '#EF4444',
          expired: '#6B7280',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      backgroundImage: {
        'grid-pattern': `linear-gradient(rgba(245,166,35,0.05) 1px, transparent 1px),
                         linear-gradient(90deg, rgba(245,166,35,0.05) 1px, transparent 1px)`,
      },
      backgroundSize: {
        grid: '40px 40px',
      },
    },
  },
  plugins: [],
}

export default config
