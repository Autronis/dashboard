import type { Config } from 'tailwindcss';

const config: Config = {
  // 'class' strategie: dark mode wordt geactiveerd via een .dark klasse op <html>
  // Dit is vereist voor next-themes compatibiliteit
  darkMode: 'class',

  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],

  theme: {
    extend: {
      colors: {
        // Optioneel: CSS-variabele tokens beschikbaar maken als Tailwind kleuren
        nav: {
          bg: 'var(--color-nav-bg)',
          border: 'var(--color-nav-border)',
          text: 'var(--color-nav-text)',
          muted: 'var(--color-nav-text-muted)',
        },
        sidebar: {
          bg: 'var(--color-sidebar-bg)',
          border: 'var(--color-sidebar-border)',
          activeBg: 'var(--color-sidebar-active-bg)',
          activeText: 'var(--color-sidebar-active-text)',
        },
      },
    },
  },

  plugins: [],
};

export default config;