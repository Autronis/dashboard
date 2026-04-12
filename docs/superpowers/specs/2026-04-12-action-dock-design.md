# Action Dock — Design Spec

## Doel

Vervang de mobile bottom navigation bar met een context-aware shortcut dock. Dezelfde dock verschijnt ook op desktop als floating pill onderaan. De shortcuts passen zich aan op basis van de huidige route.

## Waarom

- De huidige mobile bottom bar heeft nav items (Dashboard, Timer, Taken, Ideeën, Meer) die ook via de hamburger bereikbaar zijn — dubbele navigatie
- Op mobiel is de duim-zone het meest ergonomische plek voor ACTIES, niet voor nav
- Op desktop bestaat al een FAB met 5 quick actions, maar die is niet context-aware
- Behoefte aan snelle, context-gevoelige acties: op `/ideeen` wil je "Voer idee uit", niet "Nieuwe klant"

## Aanpak

Eén nieuwe component `ActionDock` die op beide platforms rendert, met verschillende layout per breakpoint. Een centrale action registry mapt routes naar shortcut-IDs. De bestaande `BottomNav` en `QuickActionButton` (FAB) worden verwijderd.

---

## 1. Component structuur

### Nieuw: `src/components/layout/action-dock.tsx`

Eén component met responsive rendering:

**Mobiel (`< md`):**
- `fixed bottom-0 inset-x-0`
- Safe-area-inset-bottom padding
- Full width, rounded-top-2xl
- `bg-autronis-card/95 backdrop-blur-xl border-t border-autronis-border`
- 5 shortcut buttons + 1 "..." overflow button, evenly spaced
- Icon 20px + label 10px eronder, min tap target 44×44
- Active state: `text-autronis-accent` + subtiele scale
- Haptic feedback bij tap (`navigator.vibrate?.(10)`)

**Desktop (`≥ md`):**
- `fixed bottom-6 left-1/2 -translate-x-1/2`
- Floating pill, `rounded-2xl`
- `bg-autronis-card/90 backdrop-blur-xl border border-autronis-border shadow-2xl shadow-autronis-accent/10`
- 5 icon-only buttons + 1 "..." overflow, horizontaal rij
- Icon 20px, button `w-11 h-11`
- Tooltip bij hover met label + optionele keyboard shortcut
- Hover: `bg-autronis-accent/10 text-autronis-accent`
- `z-40` (boven content, onder modals)

**Animaties:**
- Framer Motion `layout` animation wanneer shortcuts veranderen bij route change (morph)
- `scale-95` on tap/click
- Overflow sheet: slide-up op mobiel, fade+scale op desktop

---

## 2. Action Registry

### Nieuw: `src/components/layout/action-registry.tsx`

Eén file met alle action definitions en route mappings.

```typescript
import type { LucideIcon } from "lucide-react";

export type ActionId =
  | "timer-start"
  | "taak-nieuw"
  | "idee-nieuw"
  | "idee-voer-uit"
  | "idee-backlog"
  | "ai-brainstorm"
  | "dagritme"
  | "search"
  | "timer-op-taak"
  | "plan-agenda"
  | "taak-klaar"
  | "focus"
  | "factuur-nieuw"
  | "uitgave-nieuw"
  | "bank-import"
  | "btw-aangifte"
  | "revolut-sync"
  | "klant-nieuw"
  | "lead-nieuw"
  | "offerte-nieuw"
  | "notitie-nieuw"
  | "mail-nieuw"
  | "timer-toggle"
  | "tijd-handmatig"
  | "locatie-toggle"
  | "tijd-week"
  | "focus-sessie"
  | "project-nieuw"
  | "project-voortgang"
  | "teamlid-toevoegen"
  | "agenda-nieuw"
  | "agenda-vandaag"
  | "google-sync"
  | "meeting-plannen"
  | "wiki-nieuw"
  | "wiki-zoek"
  | "wiki-import"
  | "second-brain-save"
  | "focus-start"
  | "focus-block"
  | "focus-pauze"
  | "focus-stats"
  | "lead-converteren"
  | "pipeline-view"
  | "followup-sturen"
  | "dashboard";

export interface ActionContext {
  router: ReturnType<typeof import("next/navigation").useRouter>;
  pathname: string;
  openModal: (name: string, props?: Record<string, unknown>) => void;
  openCommandPalette: () => void;
}

export interface ActionDef {
  id: ActionId;
  label: string;
  icon: LucideIcon;
  shortcut?: string;  // optional keyboard hint for tooltip
  handler: (ctx: ActionContext) => void | Promise<void>;
}

export const ACTIONS: Record<ActionId, ActionDef> = {
  // ... full definitions, one per action
};

export const SHORTCUTS_BY_ROUTE: Record<string, ActionId[]> = {
  "/": ["timer-start", "taak-nieuw", "idee-nieuw", "dagritme", "search"],
  "/ideeen": ["idee-nieuw", "idee-voer-uit", "idee-backlog", "ai-brainstorm", "search"],
  "/taken": ["taak-nieuw", "timer-op-taak", "plan-agenda", "taak-klaar", "focus"],
  "/financien": ["factuur-nieuw", "uitgave-nieuw", "bank-import", "btw-aangifte", "revolut-sync"],
  "/klanten": ["klant-nieuw", "lead-nieuw", "offerte-nieuw", "notitie-nieuw", "mail-nieuw"],
  "/tijd": ["timer-toggle", "tijd-handmatig", "locatie-toggle", "tijd-week", "focus-sessie"],
  "/projecten": ["project-nieuw", "taak-nieuw", "timer-op-taak", "project-voortgang", "teamlid-toevoegen"],
  "/agenda": ["agenda-nieuw", "plan-agenda", "agenda-vandaag", "google-sync", "meeting-plannen"],
  "/wiki": ["wiki-nieuw", "wiki-zoek", "wiki-import", "second-brain-save", "dashboard"],
  "/focus": ["focus-start", "focus-block", "focus-pauze", "focus-stats", "idee-nieuw"],
  "/sales-engine": ["lead-nieuw", "offerte-nieuw", "followup-sturen", "pipeline-view", "lead-converteren"],
  "/leads": ["lead-nieuw", "offerte-nieuw", "followup-sturen", "pipeline-view", "lead-converteren"],
  "/offertes": ["lead-nieuw", "offerte-nieuw", "followup-sturen", "pipeline-view", "lead-converteren"],
};

export const FALLBACK_SHORTCUTS: ActionId[] = [
  "timer-start",
  "taak-nieuw",
  "idee-nieuw",
  "dashboard",
  "search",
];
```

### Route matching

Een helper `getShortcutsForRoute(pathname: string): ActionId[]`:

1. Probeer exacte match (`pathname === key`)
2. Probeer prefix match, langste eerst (`pathname.startsWith(key + "/")`)
3. Fallback naar `FALLBACK_SHORTCUTS`

Dit betekent `/financien/nieuw` of `/financien/123` gebruikt de `/financien` shortcuts.

---

## 3. Hook: `useActionShortcuts()`

### Nieuw: `src/hooks/use-action-shortcuts.ts`

```typescript
export function useActionShortcuts() {
  const pathname = usePathname();
  const router = useRouter();
  const { openModal } = useModalStore();  // existing or new
  const { setOpen: setCmdPaletteOpen } = useCommandPalette();

  const ids = useMemo(() => getShortcutsForRoute(pathname), [pathname]);
  const allActionIds = useMemo(() => Object.keys(ACTIONS) as ActionId[], []);

  const ctx: ActionContext = {
    router,
    pathname,
    openModal,
    openCommandPalette: () => setCmdPaletteOpen(true),
  };

  const visible = ids.map((id) => ({ ...ACTIONS[id], run: () => ACTIONS[id].handler(ctx) }));
  const all = allActionIds.map((id) => ({ ...ACTIONS[id], run: () => ACTIONS[id].handler(ctx) }));

  return { visible, all };
}
```

---

## 4. Overflow menu

**Mobiel:** Bottom sheet via Framer Motion. Opent van onder, toont alle acties in een lijst gegroepeerd per categorie (Maak, Doe, Navigeer), met search-input bovenin.

**Desktop:** Popover die opent naast de "..." button. Zelfde lijst structuur.

Bestaat als sub-component: `src/components/layout/action-dock-overflow.tsx`

---

## 5. Modal wiring

Veel acties openen bestaande modals. Die modals leven momenteel in context van hun eigen pagina (bijv. `KlantModal` in `/klanten`). Voor de dock hebben we een globale trigger nodig.

### Aanpak: Zustand modal store

Nieuw: `src/stores/modal-store.ts`

```typescript
interface ModalState {
  activeModal: string | null;
  modalProps: Record<string, unknown>;
  openModal: (name: string, props?: Record<string, unknown>) => void;
  closeModal: () => void;
}
```

Nieuw: `src/components/layout/global-modal-host.tsx` — geplaatst in dashboard layout, luistert naar de store en rendert de juiste modal (KlantModal, ProjectModal, TaakModal, HandmatigModal, NoteModal, etc).

Acties zoals `"klant-nieuw"` callen `ctx.openModal("klant")`. Bestaande pagina's kunnen ook van deze store gebruik maken (optioneel, geen verplichte refactor).

---

## 6. Verwijderen

### Te verwijderen componenten
- `src/components/layout/bottom-nav.tsx` — volledig weg
- `src/components/ui/quick-action-button.tsx` — volledig weg

### Te updaten
- `src/components/layout/` — de plek waar BottomNav werd ingevoegd in de dashboard layout, vervangen door ActionDock
- Dashboard layout — voeg `<GlobalModalHost />` toe
- Verwijder `<QuickActionButton />` waar die gerendered wordt

De nav items die in BottomNav stonden (Dashboard, Timer, Taken, Ideeën, Meer) hoeven niet terug — ze zijn al in de hamburger menu/sidebar op mobiel.

---

## 7. Acties — volledige lijst per pagina

### Dashboard (`/`)
1. ⚡ `timer-start` → Timer starten → navigate `/tijd` + auto-start
2. ✅ `taak-nieuw` → Nieuwe taak → open TaakModal
3. 💡 `idee-nieuw` → Idee vastleggen → open IdeeModal of inline prompt
4. 📝 `dagritme` → Dagritme → navigate `/dagritme`
5. 🔍 `search` → Zoeken → open command palette

### Ideeën (`/ideeen`)
1. 💡 `idee-nieuw` → Nieuw idee → open IdeeModal
2. 🚀 `idee-voer-uit` → Voer idee uit → open converter modal (idee → project)
3. 📦 `idee-backlog` → Naar backlog → status update op huidig geselecteerd idee
4. 🤖 `ai-brainstorm` → AI brainstorm → trigger de bestaande generate-ideas flow
5. 🔍 `search` → Zoeken in ideeën → command palette met scope filter

### Taken (`/taken`)
1. ➕ `taak-nieuw` → Nieuwe taak → TaakModal
2. ⚡ `timer-op-taak` → Start timer op geselecteerde taak
3. 📅 `plan-agenda` → Plan in agenda → PlanTaakModal
4. ✅ `taak-klaar` → Markeer klaar → API call op geselecteerde taak
5. 🎯 `focus` → Focus mode → navigate `/focus`

### Financiën (`/financien`)
1. 📄 `factuur-nieuw` → Nieuwe factuur → navigate `/financien/nieuw`
2. 🧾 `uitgave-nieuw` → Uitgave → UitgaveModal
3. 🏦 `bank-import` → Bank import → navigate `/financien?tab=bank`
4. 📊 `btw-aangifte` → BTW aangifte → navigate `/belasting`
5. 📥 `revolut-sync` → Revolut sync → API trigger + toast

### Klanten (`/klanten`)
1. 👤 `klant-nieuw` → Nieuwe klant → KlantModal
2. 📞 `lead-nieuw` → Lead → LeadModal
3. 📄 `offerte-nieuw` → Offerte → navigate `/offertes/nieuw`
4. 🗒️ `notitie-nieuw` → Notitie → NoteModal op geselecteerde klant
5. 📧 `mail-nieuw` → Mail → open mail composer / mailto

### Tijd (`/tijd`)
1. ▶️ `timer-toggle` → Timer start/stop → toggle actieve timer
2. ✍️ `tijd-handmatig` → Handmatige registratie → HandmatigModal
3. 🏠 `locatie-toggle` → Thuis/kantoor → update huidige sessie
4. 📊 `tijd-week` → Week overzicht → tab-switch
5. 🎯 `focus-sessie` → Focus → navigate `/focus`

### Projecten (`/projecten`)
1. 🚀 `project-nieuw` → Nieuw project → ProjectModal
2. ✅ `taak-nieuw` → Taak → TaakModal in context huidig project
3. ⏱️ `timer-op-taak` → Timer
4. 📊 `project-voortgang` → Voortgang bijwerken → inline prompt
5. 👥 `teamlid-toevoegen` → Teamlid → TeamModal

### Agenda (`/agenda`)
1. 📅 `agenda-nieuw` → Nieuwe afspraak → AfspraakModal
2. 📝 `plan-agenda` → Plan taak → PlanTaakModal
3. ⏭️ `agenda-vandaag` → Spring naar vandaag → scroll/date-state
4. 🔄 `google-sync` → Google sync → API trigger + toast
5. 👥 `meeting-plannen` → Meeting → MeetingModal

### Wiki (`/wiki`)
1. 📄 `wiki-nieuw` → Nieuwe pagina → navigate `/wiki/nieuw`
2. 🔍 `wiki-zoek` → Zoek in wiki → command palette scope
3. 📥 `wiki-import` → Import from URL → ImportModal
4. 🏷️ `second-brain-save` → Save to Second Brain → API + toast
5. 🏠 `dashboard` → Dashboard → navigate `/`

### Focus (`/focus`)
1. 🎯 `focus-start` → Start focus sessie → API + state
2. 🚫 `focus-block` → Distraction block → toggle
3. ⏸️ `focus-pauze` → Pauze → toggle
4. 📊 `focus-stats` → Vandaag's stats → modal
5. 💡 `idee-nieuw` → Idee loggen → modal (niet breekt focus)

### Sales (`/sales-engine`, `/leads`, `/offertes`)
1. 📞 `lead-nieuw` → Nieuwe lead → LeadModal
2. 💼 `offerte-nieuw` → Offerte → navigate `/offertes/nieuw`
3. 📧 `followup-sturen` → Follow-up → FollowupModal
4. 📊 `pipeline-view` → Pipeline → view-switch
5. ✅ `lead-converteren` → Converteren → ConverterModal

### Fallback (overige routes)
1. ⚡ `timer-start` → Timer
2. ✅ `taak-nieuw` → Taak
3. 💡 `idee-nieuw` → Idee
4. 🏠 `dashboard` → Dashboard
5. 🔍 `search` → Zoeken

---

## 8. Safe-area & z-index

- Mobile dock gebruikt `env(safe-area-inset-bottom)` voor iPhone notches
- Desktop dock `z-40`, onder modals (`z-50`) maar boven content
- Content padding: body krijgt `pb-20 md:pb-0` op mobiel om niet onder de dock te verdwijnen
- Bestaande components die `pb-20` gebruikten voor de oude BottomNav blijven hetzelfde werken

---

## 9. Accessibility

- Alle buttons hebben `aria-label`
- Keyboard navigable: Tab door de dock buttons
- Focus visible: `ring-2 ring-autronis-accent`
- Tooltips via Radix Tooltip / custom (al in project?) — fallback: `title` attribuut
- Overflow sheet: focus trap, Escape sluit

---

## 10. Technische details

### Stack
- Next.js 16 App Router
- React 19
- Tailwind CSS v4 met `autronis-*` custom properties
- Framer Motion voor animaties
- lucide-react voor icons
- Zustand voor modal state (nieuwe `modal-store`)
- `usePathname()` van `next/navigation` voor route matching

### Plaatsing
- `ActionDock` wordt gerendered in de dashboard layout (`src/app/(dashboard)/layout.tsx`)
- `GlobalModalHost` ook daar
- Responsive: één component, Tailwind breakpoint classes voor mobile/desktop styling

### Registry groei
Action registry is één file. Als het te groot wordt (> 300 regels), split in `actions/` directory per categorie (actions/taken.ts, actions/financien.ts, etc) met een barrel export.
