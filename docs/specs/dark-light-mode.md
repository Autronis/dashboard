# Technische Specificatie: Dark/Light Mode Toggle

## Overzicht

Deze specificatie beschrijft de implementatie van een dark/light mode toggle in de sidebar van de Autronis applicatie.

---

## 1. Technische Aanpak

### 1.1 Keuze: Tailwind Dark Mode

We kiezen voor **Tailwind CSS dark mode** met de `class`-strategie boven pure CSS-variabelen om de volgende redenen:

- Native integratie met de bestaande Tailwind-setup
- Geen extra CSS-variabelen overhead naast Tailwind utility classes
- Type-safe via de bestaande configuratie
- Makkelijk combineerbaar met component-level styling (`dark:bg-gray-900`, etc.)
- Betere tree-shaking en purging door Tailwind's build pipeline

**Configuratie in `tailwind.config.ts`:**

```ts
import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: 'class', // Stuur op basis van .dark class op <html>
  content: [
    './src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}

export default config
```

> De `.dark` class wordt op het `<html>`-element gezet. Tailwind past dan automatisch alle `dark:` prefixed utilities toe.

---

## 2. Opslag van Gebruikersvoorkeur

### 2.1 Keuze: localStorage

We gebruiken **localStorage** voor opslag van de themavoorkeur:

| Criterium         | localStorage | Cookie |
|-------------------|:------------:|:------:|
| Eenvoud           | ✅           | ❌     |
| Geen server nodig | ✅           | ❌     |
| SSR-compatibel    | ⚠️ (hydration) | ✅  |
| Persistentie      | ✅           | ✅     |
| Grootte overhead  | ✅           | ❌     |

**Conclusie:** Voor een client-side Next.js sidebar is localStorage de eenvoudigste en meest performante oplossing. Het hydration-issue wordt opgelost via een `suppressHydrationWarning` attribuut op `<html>` en een inline script voor FOUC-preventie.

**localStorage key:** `autronis-theme`  
**Mogelijke waarden:** `'light'` | `'dark'`

### 2.2 FOUC-preventie (Flash of Unstyled Content)

Om te voorkomen dat de pagina kort in de verkeerde modus flitst, wordt een inline `<script>` in `_document.tsx` / `layout.tsx` toegevoegd die vóór de eerste render de juiste class op `<html>` plaatst:

```ts
// In src/app/layout.tsx - inline script voor FOUC-preventie
const themeScript = `
  (function() {
    try {
      var theme = localStorage.getItem('autronis-theme');
      var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      if (theme === 'dark' || (!theme && prefersDark)) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    } catch(e) {}
  })()
`;
```

---

## 3. Architectuur & Bestandsstructuur

```
src/
├── app/
│   └── layout.tsx                  # Root layout: suppressHydrationWarning + FOUC script
├── components/
│   ├── providers/
│   │   └── ThemeProvider.tsx        # Context provider voor thema state
│   ├── sidebar/
│   │   ├── Sidebar.tsx              # Bestaande sidebar (integratie toggle)
│   │   └── ThemeToggle.tsx          # Toggle knop component
│   └── ui/
│       └── Icon.tsx                 # (optioneel) Zon/maan iconen
├── hooks/
│   └── useTheme.ts                  # Custom hook voor theme access
└── types/
    └── theme.ts                     # Theme types
```

---

## 4. Type Definities

```ts
// src/types/theme.ts

export type Theme = 'light' | 'dark';

export interface ThemeContextValue {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
}
```

---

## 5. ThemeProvider

```tsx
// src/components/providers/ThemeProvider.tsx

'use client';

import React, { createContext, useCallback, useEffect, useState } from 'react';
import type { Theme, ThemeContextValue } from '@/types/theme';

const STORAGE_KEY = 'autronis-theme';

export const ThemeContext = createContext<ThemeContextValue | null>(null);

interface ThemeProviderProps {
  children: React.ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const [theme, setThemeState] = useState<Theme>('light');

  useEffect(() => {
    // Lees initiële waarde uit localStorage of system preference
    const stored = localStorage.getItem(STORAGE_KEY) as Theme | null;
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const initial: Theme = stored ?? (prefersDark ? 'dark' : 'light');
    applyTheme(initial);
    setThemeState(initial);
  }, []);

  const applyTheme = (newTheme: Theme): void => {
    const root = document.documentElement;
    if (newTheme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem(STORAGE_KEY, newTheme);
  };

  const setTheme = useCallback((newTheme: Theme): void => {
    applyTheme(newTheme);
    setThemeState(newTheme);
  }, []);

  const toggleTheme = useCallback((): void => {
    setThemeState((prev) => {
      const next: Theme = prev === 'light' ? 'dark' : 'light';
      applyTheme(next);
      return next;
    });
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
```

---

## 6. useTheme Hook

```ts
// src/hooks/useTheme.ts

import { useContext } from 'react';
import { ThemeContext } from '@/components/providers/ThemeProvider';
import type { ThemeContextValue } from '@/types/theme';

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme moet binnen een ThemeProvider gebruikt worden');
  }
  return context;
}
```

---

## 7. ThemeToggle Component

```tsx
// src/components/sidebar/ThemeToggle.tsx

'use client';

import { useTheme } from '@/hooks/useTheme';
import { MoonIcon, SunIcon } from '@heroicons/react/24/outline';

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      aria-label={theme === 'light' ? 'Schakel naar donkere modus' : 'Schakel naar lichte modus'}
      className="
        flex items-center gap-2 w-full px-3 py-2 rounded-md text-sm font-medium
        text-gray-700 hover:bg-gray-100
        dark:text-gray-300 dark:hover:bg-gray-700
        transition-colors duration-200
      "
    >
      {theme === 'light' ? (
        <>
          <MoonIcon className="h-5 w-5" aria-hidden="true" />
          <span>Donkere modus</span>
        </>
      ) : (
        <>
          <SunIcon className="h-5 w-5" aria-hidden="true" />
          <span>Lichte modus</span>
        </>
      )}
    </button>
  );
}
```

---

## 8. Integratie in Root Layout

```tsx
// src/app/layout.tsx (relevante aanpassingen)

import { ThemeProvider } from '@/components/providers/ThemeProvider';

const themeScript = `
  (function() {
    try {
      var theme = localStorage.getItem('autronis-theme');
      var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      if (theme === 'dark' || (!theme && prefersDark)) {
        document.documentElement.classList.add('dark');
      }
    } catch(e) {}
  })()
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="nl" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <ThemeProvider>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
```

---

## 9. Sidebar Integratie

De `ThemeToggle` wordt onderaan de sidebar geplaatst, gescheiden van de navigatie-items:

```tsx
// src/components/sidebar/Sidebar.tsx (relevante aanpassingen)

import { ThemeToggle } from './ThemeToggle';

export function Sidebar() {
  return (
    <aside className="flex flex-col h-full w-64 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700">
      {/* Navigatie items */}
      <nav className="flex-1 px-2 py-4">
        {/* ... bestaande nav items ... */}
      </nav>

      {/* Theme toggle onderaan */}
      <div className="px-2 py-4 border-t border-gray-200 dark:border-gray-700">
        <ThemeToggle />
      </div>
    </aside>
  );
}
```

---

## 10. Benodigde Dependencies

| Package | Versie | Doel |
|---------|--------|------|
| `@heroicons/react` | `^2.0.0` | Zon/maan iconen voor toggle |

Installatie:
```bash
npm install @heroicons/react
```

> Als het project al een icoonsysteem gebruikt (bijv. Lucide React), dienen de iconen daaruit te worden gehaald in plaats van Heroicons.

---

## 11. Toegankelijkheid (a11y)

- De toggle knop heeft een dynamisch `aria-label` dat de huidige actie beschrijft
- Kleurcontrast voldoet aan WCAG 2.1 AA in beide modi
- Focus-states zijn zichtbaar in beide modi via Tailwind `focus:ring` utilities
- Systeemvoorkeur (`prefers-color-scheme`) wordt gerespecteerd bij eerste bezoek

---

## 12. Teststrategie

| Test | Type | Tool |
|------|------|------|
| ThemeProvider context rendering | Unit | Jest + Testing Library |
| toggleTheme wisselt correct | Unit | Jest |
| localStorage persistentie | Unit | Jest (mock localStorage) |
| FOUC-preventie script | Integration | Playwright |
| Visuele correctheid dark/light | E2E | Playwright |

---

## 13. Beslissingslog

| Beslissing | Alternatief | Reden keuze |
|------------|-------------|-------------|
| Tailwind `class` dark mode | CSS variabelen | Native Tailwind integratie, minder overhead |
| localStorage | Cookie | Geen SSR-vereiste voor sidebar, eenvoudiger |
| React Context | Zustand/Jotai | Geen extra state library nodig voor enkelvoudige waarde |
| `<html>` class toggle | `data-theme` attribuut | Tailwind's standaard dark mode mechanisme |
| Inline FOUC script | CSS `@media` fallback | Directe controle vóór eerste render |
