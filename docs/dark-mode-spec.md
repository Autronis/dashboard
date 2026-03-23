# Dark Mode Implementatie Specificatie

## Overzicht

Deze specificatie beschrijft de technische aanpak voor het toevoegen van een dark mode toggle aan de navbar van de Autronis applicatie. De implementatie maakt gebruik van Next.js, TypeScript en Tailwind CSS.

---

## 1. Architectuur Overzicht

```
┌─────────────────────────────────────────────────────────┐
│                    ThemeProvider                        │
│  (Context: theme, toggleTheme, setTheme)                │
│                                                         │
│   ┌─────────────┐        ┌──────────────────────────┐  │
│   │  Navbar     │        │  Overige componenten     │  │
│   │  └ ThemeToggle│      │  (gebruiken useTheme)    │  │
│   └─────────────┘        └──────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
         │                          │
         ▼                          ▼
  localStorage              CSS Variabelen
  ('theme': 'light'|        op :root / .dark
   'dark'|'system')         selector
```

---

## 2. Theme Provider Aanpak

### 2.1 ThemeContext

Een React Context wordt gebruikt om de huidige thema-staat globaal beschikbaar te maken zonder prop drilling.

**Locatie:** `src/context/ThemeContext.tsx`

```typescript
type Theme = 'light' | 'dark' | 'system';

interface ThemeContextValue {
  theme: Theme;
  resolvedTheme: 'light' | 'dark'; // effectief actief thema
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
}
```

### 2.2 ThemeProvider Component

**Locatie:** `src/components/providers/ThemeProvider.tsx`

- Wikkelt de gehele applicatie in `app/layout.tsx`
- Leest initiële voorkeur uit `localStorage`
- Valt terug op `prefers-color-scheme` media query als geen voorkeur is opgeslagen
- Injecteert een `script` tag (inline, blocking) om FOUC (Flash of Unstyled Content) te voorkomen
- Luistert naar wijzigingen in `prefers-color-scheme` wanneer `theme === 'system'`

### 2.3 useTheme Hook

**Locatie:** `src/hooks/useTheme.ts`

Een convenience hook die de ThemeContext consumeert met een guard voor gebruik buiten de provider.

---

## 3. CSS Variabelen Strategie

### 3.1 Aanpak: Tailwind CSS `darkMode: 'class'`

Tailwind wordt geconfigureerd met `darkMode: 'class'` in `tailwind.config.ts`. De ThemeProvider voegt de klasse `dark` toe aan het `<html>` element.

```typescript
// tailwind.config.ts
const config: Config = {
  darkMode: 'class',
  // ...
};
```

### 3.2 CSS Custom Properties

**Locatie:** `src/styles/globals.css`

Alle kleurwaarden worden gedefinieerd als CSS variabelen op de `:root` selector en overschreven onder `.dark`.

```css
:root {
  /* Achtergronden */
  --color-bg-primary: #ffffff;
  --color-bg-secondary: #f8fafc;
  --color-bg-tertiary: #f1f5f9;

  /* Tekst */
  --color-text-primary: #0f172a;
  --color-text-secondary: #475569;
  --color-text-muted: #94a3b8;

  /* Navbar specifiek */
  --color-navbar-bg: #ffffff;
  --color-navbar-border: #e2e8f0;
  --color-navbar-text: #0f172a;

  /* Interactief */
  --color-interactive-primary: #3b82f6;
  --color-interactive-hover: #2563eb;

  /* Toggle */
  --color-toggle-bg: #e2e8f0;
  --color-toggle-thumb: #ffffff;
  --color-toggle-active-bg: #3b82f6;
}

.dark {
  /* Achtergronden */
  --color-bg-primary: #0f172a;
  --color-bg-secondary: #1e293b;
  --color-bg-tertiary: #334155;

  /* Tekst */
  --color-text-primary: #f8fafc;
  --color-text-secondary: #cbd5e1;
  --color-text-muted: #64748b;

  /* Navbar specifiek */
  --color-navbar-bg: #1e293b;
  --color-navbar-border: #334155;
  --color-navbar-text: #f8fafc;

  /* Interactief */
  --color-interactive-primary: #60a5fa;
  --color-interactive-hover: #93c5fd;

  /* Toggle */
  --color-toggle-bg: #334155;
  --color-toggle-thumb: #f8fafc;
  --color-toggle-active-bg: #60a5fa;
}
```

### 3.3 Tailwind Integratie

CSS variabelen worden geregistreerd in `tailwind.config.ts` onder `theme.extend.colors` zodat ze als Tailwind utilities bruikbaar zijn:

```typescript
colors: {
  'bg-primary': 'var(--color-bg-primary)',
  'text-primary': 'var(--color-text-primary)',
  'navbar-bg': 'var(--color-navbar-bg)',
  // ...
}
```

---

## 4. localStorage Persistentie

### 4.1 Sleutel en Schema

```typescript
const THEME_STORAGE_KEY = 'autronis-theme' as const;
type StoredTheme = 'light' | 'dark' | 'system';
```

### 4.2 Lees/Schrijf Strategie

- **Lezen:** Bij mount van ThemeProvider wordt `localStorage.getItem(THEME_STORAGE_KEY)` aangeroepen. Indien `null` of een ongeldige waarde, wordt `'system'` als standaard gebruikt.
- **Schrijven:** Bij elke `setTheme` aanroep wordt `localStorage.setItem(THEME_STORAGE_KEY, theme)` aangeroepen.
- **Validatie:** De opgeslagen waarde wordt gevalideerd tegen het `StoredTheme` type voor gebruik.

### 4.3 FOUC Preventie Script

Een inline script wordt gesynchroniseerd uitgevoerd vóór de eerste render om `<html>` de juiste klasse te geven:

```html
<!-- Geïnjecteerd in <head> via Next.js Script component met strategy="beforeInteractive" -->
<script>
  (function () {
    const STORAGE_KEY = 'autronis-theme';
    const stored = localStorage.getItem(STORAGE_KEY);
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const shouldBeDark =
      stored === 'dark' || (stored !== 'light' && prefersDark);
    if (shouldBeDark) {
      document.documentElement.classList.add('dark');
    }
  })();
</script>
```

---

## 5. Component Structuur

### 5.1 Bestandsstructuur

```
src/
├── app/
│   └── layout.tsx                    # ThemeProvider wrapper + FOUC script
├── components/
│   ├── navbar/
│   │   ├── Navbar.tsx                # Navbar container
│   │   └── ThemeToggle.tsx           # Toggle knop component
│   └── providers/
│       └── ThemeProvider.tsx         # Context provider
├── context/
│   └── ThemeContext.tsx              # Context definitie + types
├── hooks/
│   └── useTheme.ts                   # useTheme hook
└── styles/
    └── globals.css                   # CSS variabelen
```

### 5.2 Component Verantwoordelijkheden

#### `ThemeContext.tsx`
- Definieert `Theme` type en `ThemeContextValue` interface
- Exporteert de React Context

#### `ThemeProvider.tsx`
- Beheert de `theme` state
- Synchroniseert met `localStorage`
- Past `dark` klasse toe op `document.documentElement`
- Luistert naar `prefers-color-scheme` wijzigingen (alleen bij `theme === 'system'`)
- Biedt `toggleTheme` (light ↔ dark) en `setTheme` aan

#### `useTheme.ts`
- Consumeert `ThemeContext`
- Gooit een foutmelding als gebruikt buiten `ThemeProvider`

#### `ThemeToggle.tsx`
- Client Component (`'use client'`)
- Gebruikt `useTheme` hook
- Rendert een toggle knop met zon/maan icoon (bijv. `lucide-react`)
- Aria-labels in het Nederlands: `'Schakel naar donkere modus'` / `'Schakel naar lichte modus'`
- Ondersteunt keyboard navigatie en focus-visible stijlen

#### `Navbar.tsx`
- Importeert en rendert `ThemeToggle` op de juiste positie
- Gebruikt CSS variabelen voor kleuren

---

## 6. State Machine

```
         toggleTheme()        toggleTheme()
  light ──────────────► dark ──────────────► light
    ▲                    ▲
    │   setTheme()       │   setTheme()
    └────────────────────┘
           system ──► resolvedTheme (light | dark)
                       via matchMedia
```

`toggleTheme()` wisselt enkel tussen `'light'` en `'dark'` (nooit naar `'system'`).
`setTheme()` stelt een expliciete voorkeur in inclusief `'system'`.

---

## 7. Toegankelijkheid (A11y)

- Toggle knop heeft een beschrijvend `aria-label` dat de huidige actie beschrijft
- `aria-pressed` attribuut geeft de actieve staat aan
- Focus-visible outline aanwezig voor keyboard gebruikers
- Icoon is decoratief (`aria-hidden="true"`); label draagt de betekenis
- Transitie-animaties respecteren `prefers-reduced-motion`:

```css
@media (prefers-reduced-motion: reduce) {
  .theme-toggle {
    transition: none;
  }
}
```

---

## 8. Testen Strategie

| Test Type | Wat testen | Tool |
|-----------|-----------|------|
| Unit | `useTheme` hook gedrag | Jest + React Testing Library |
| Unit | ThemeProvider: localStorage lezen/schrijven | Jest |
| Unit | ThemeProvider: system preference | Jest (matchMedia mock) |
| Component | ThemeToggle rendering & click | React Testing Library |
| E2E | Toggle persisteert na page reload | Playwright |
| E2E | Correct thema bij system preference | Playwright |

---

## 9. Performance Overwegingen

- Het FOUC preventie script is minimaal (<500 bytes) en geblokkeerd synchroon
- `localStorage` toegang is synchroon maar eenmalig bij mount
- `matchMedia` event listener wordt opgeruimd bij unmount
- CSS variabelen zorgen voor één reflow bij thema-wisseling
- Geen onnodige re-renders: enkel componenten die `useTheme` gebruiken re-renderen

---

## 10. Afhankelijkheden

| Pakket | Versie | Doel |
|--------|--------|------|
| `next` | ≥14.0 | App Router, Script component |
| `react` | ≥18.0 | Context API, hooks |
| `tailwindcss` | ≥3.4 | `darkMode: 'class'` |
| `lucide-react` | ≥0.400 | Zon/Maan iconen voor toggle |

Geen extra theming libraries (bijv. `next-themes`) zijn vereist; de implementatie is volledig op maat.

---

## 11. Uitbreidbaarheid

- Extra thema's (bijv. `'high-contrast'`) kunnen worden toegevoegd door het `Theme` type uit te breiden en extra CSS variabelen te definiëren
- Thema-wisseling per pagina is mogelijk via `setTheme` in page-level componenten
- Server-side thema detectie (via cookie) kan worden toegevoegd als FOUC een probleem blijft op specifieke deployment omgevingen
