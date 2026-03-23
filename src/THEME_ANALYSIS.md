# Thema-implementatie – Analyse & Bevindingen

## Probleemstelling
De light/dark toggle werkte niet correct voor de `<Navbar>` en `<Sidebar>` componenten.

---

## Oorzaken

### 1. `darkMode` strategie niet ingesteld op `"class"`
Tailwind ondersteunt twee strategieën:
- `"media"` – volgt het OS-thema via `prefers-color-scheme` (standaard).
- `"class"` – activeert dark mode wanneer een voorouder-element de klasse `dark` heeft.

Zonder `darkMode: "class"` in `tailwind.config.ts` negeren alle `dark:` utility-klassen de JavaScript-toggle volledig.

### 2. Navbar / Sidebar misten `dark:` utility-klassen
De componenten hadden vaste kleurklassen (`bg-white`, `text-gray-900`) zonder bijbehorende `dark:`-varianten. Hierdoor bleven ze wit/licht terwijl de rest van de pagina al donker werd.

### 3. Geen transitie-klassen
Zonder `transition-colors duration-300` springt het kleurenschema abrupt, wat een onprettige UX oplevert.

### 4. Ontbrekende CSS custom properties
Er waren geen gedeelde CSS-variabelen (`--color-bg`, `--color-surface`, enz.) voor consistente kleurwaarden over componenten heen.

---

## Oplossing (samenvatting per bestand)

| Bestand | Wijziging |
|---|---|
| `tailwind.config.ts` | `darkMode: "class"` toegevoegd + semantische kleur-tokens via CSS variabelen |
| `src/styles/globals.css` | `:root` en `.dark` CSS-variabelen gedefinieerd; `transition` op `html` en `body` |
| `src/components/ThemeToggle.tsx` | Toggle voegt `.dark` toe/verwijdert van `document.documentElement`; persisteert in `localStorage` |
| `src/components/Navbar.tsx` | `dark:` klassen toegevoegd + `transition-colors` |
| `src/components/Sidebar.tsx` | `dark:` klassen toegevoegd + `transition-colors` |

---

## Hoe dark mode nu werkt

```
Gebruiker klikt toggle
  └─> ThemeToggle.toggle()
        └─> document.documentElement.classList.add("dark")   // of .remove()
              └─> Tailwind activeert alle dark: utilities
                    └─> Navbar, Sidebar, body krijgen donkere achtergrond/tekst
              └─> localStorage.setItem("theme", "dark")       // persistentie
```

## Volgorde van thema-bepaling bij laden
1. `localStorage` heeft voorrang (`"dark"` of `"light"`).
2. Anders: `prefers-color-scheme: dark` systeemvoorkeur.
3. Anders: standaard licht thema.
