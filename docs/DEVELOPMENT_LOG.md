# Marly — Development Log & Checkpoint Strategy

---

## Git Checkpoint Strategy

Before every major phase or structural change:
1. Ensure working tree compiles (`npm run lint` and `npm run build`).
2. Commit cleanly with a phase-scoped message (e.g., `chore(phase-0): initialize foundation and living documentation`, `feat(phase-1): build marly design system and responsive ui shell`).
3. Verify the running preview in browser before beginning the next phase.

---

## Phase 0 — Project Foundation
**Focus:** Environment verification, documentation baseline, metadata setup, and architectural guardrails.

### Environment Findings
- Runtime verified: Node `v22.23.2`, npm `10.9.8`, Git `2.34.1`.
- Workspace runs Vite 8 + React 19 + Tailwind CSS v4 (`@tailwindcss/vite`) on port `3000`.
- `lucide-react` and `motion` are pre-installed; `express` and `@google/genai` are present for future backend and Phase 11 THINK phases.
- Workspace did not yet contain a `.git` repository; initialized Git baseline as part of Phase 0 checkpointing.

### Deliverables Completed
- Updated `metadata.json` and `index.html` with Marly identity (`Plan with purpose. Live with intention. Think with clarity.`) and Google Fonts (`Manrope` + `JetBrains Mono`).
- Created full living documentation suite in `README.md` and `docs/`.

---

## Phase 1 — Design System & UI Shell
**Focus:** Reusable component library, responsive navigation shell, URL-aware routing, isolated-demo Home dashboard, and reference-inspired LIVE visual previews.

### Deliverables Completed
1. **Design Tokens (`src/index.css`):** Dark-first `#151515` dotted canvas, `#202020` surface, `#292929` elevated state, plus Coral (`#E59585`), Mint (`#96D2C5`), Orange (`#F19A50`), Blue (`#A9C8E9`), and Purple (`#8C82E8`) tokens.
2. **Custom Brand Identity (`BrandMark`):** Abstract geometric lily-inspired SVG emblem representing the three converging pillars (PLAN, LIVE, THINK).
3. **Reusable UI Kit & Feedback (`src/components/ui/`, `src/context/ToastContext.tsx`):** Button, IconButton, Card, Input, Checkbox (with accessible hit targets and label truncation), ProgressBar, ProgressRing, Badge, SegmentedTabs (with optional `<a href>` link semantics), Dialog, EmptyState, Skeleton, ErrorState, PreviewNotice, and ToastProvider.
4. **Responsive Shell (`src/components/layout/`):** Persistent 244px desktop sidebar, compact 64px top utility bar (with Search filter, Quick Add menu, and Demo User link), tablet slide-over navigation, and mobile bottom navigation bar using semantic `<a href>` links.
5. **URL-Aware Router (`src/lib/router.ts`):** Clean History API navigation across `/`, `/plan/*`, `/live/*`, `/think`, `/statistics`, and `/settings`, with canonical alias normalization (`/plan` -> `/plan/tasks`, `/live` -> `/live/calendar`), query/hash preservation, and recoverable route-not-found UI.
6. **Isolated Data Boundary (`src/hooks/useMarlyData.ts`, `src/context/DemoStateContext.tsx`):** All feature components read demo datasets through domain-scoped hooks rather than importing `src/data/demoData.ts` directly.
7. **HOME Dashboard (`src/features/home/`):** Balanced 3-column layout anchored on **Tuesday, March 24, 2026**, featuring interactive local-demo task completion, category filtering, daily habit momentum & 7-day success chart, streak summary, and Morning/Noon/Evening schedule timeline.
8. **LIVE Visual Previews (`src/features/live/`):** Reference-inspired Streak Banner, calendar-accurate Monthly Habit Calendar (28-day Feb / 31-day Mar / 30-day Apr 2026), interactive Weekly Habit Matrix (Mar 23–29 with 40px cell hit targets), Yearly Activity Heatmap (distinguishing unscheduled rest days from 0% missed days + 12-month trend & weekday breakdown), plus Fitness & Routines Phase 8 preview.
9. **PLAN, THINK, STATISTICS & SETTINGS Previews:** Structured destinations clearly distinguished as upcoming-phase previews, plus an interactive UI Kit & State Showcase in Settings.

### Known Phase 1 Boundaries (By Design)
- All data resets on page reload; there is no database persistence yet.
- Quick Add opens the creation menu and explains the target workflow with honest demo feedback rather than writing to a backend.
- THINK displays its Phase 11 architecture and confirmation workflow without making any Gemini API calls.
