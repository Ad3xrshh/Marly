# Marly — System Architecture

## 1. Architectural Principles

1. **Frontend Is Not Business-Logic Authority:** In production phases (Phase 3+), the client handles presentation, local optimistic UI, input validation feedback, and routing. The Node.js/Express backend owns authentication verification, authorization, recurrence expansion, streak calculations, heatmap intensity math, and goal progress aggregation.
2. **Controlled AI Tooling (Phase 11):** Gemini never receives direct SQL access or unrestricted mutation powers. AI actions pass through validated backend service tools and require explicit user confirmation before committing state changes.
3. **Incremental Module Separation:** Each pillar (`home`, `plan`, `live`, `think`, `statistics`, `settings`) lives in its own feature directory consuming shared UI primitives (`src/components/ui`) and layout chrome (`src/components/layout`), keeping files small, readable, and easy to migrate from isolated demo state to real API queries.

---

## 2. Current Environment & Runtime Baseline (Phase 0/1)

Verified during Phase 0 inspection:
- **Node.js**: `v22.23.2`
- **npm**: `10.9.8`
- **Git**: `2.34.1`
- **Frontend Runtime**: Vite `8.3.0` + React `19.0.1` + TypeScript `7.0.2` + Tailwind CSS `4.3.3`
- **Installed Full-Stack Dependencies Ready for Later Phases**: `express`, `dotenv`, `tsx`, `@google/genai`, `lucide-react`, `motion`
- **Preview Port**: `3000` (required by AI Studio runtime)

---

## 3. Phase 1 Frontend Architecture

```
src/
├── types/                  # Domain interfaces (navigation, demo tasks, habits, events, stats)
├── lib/                    # Zero-dependency History API URL router & utility helpers
├── data/                   # Isolated demonstration datasets (strictly non-persistent)
├── hooks/                  # Feature data-access boundary (useMarlyData.ts)
├── context/                # DemoStateContext (local toggle/reset) & ToastContext
├── components/
│   ├── ui/                 # Reusable Design System primitives (Button, Card, Input, Checkbox, etc.)
│   └── layout/             # AppShell, Sidebar, TopBar, MobileBottomNav, BrandMark, QuickAddDialog
└── features/
    ├── home/               # 3-column daily overview dashboard
    ├── plan/               # Tasks, Calendar, Projects & Goals visual previews
    ├── live/               # Streak Banner, Monthly Calendar, Weekly Matrix, Activity Heatmap, Fitness
    ├── think/              # Phase 11 AI workflow & boundary architecture preview
    ├── statistics/         # Phase 9 cross-pillar analytics preview
    └── settings/           # Preferences preview & UI Kit state showcase
```

### URL-Aware Routing (`src/lib/router.ts`)
Rather than adding a heavy router dependency in Phase 1 or locking the app behind local `useState` tabs, Marly uses a lightweight History API router supporting clean paths:
- `/` — HOME
- `/plan`, `/plan/tasks`, `/plan/calendar`, `/plan/projects`, `/plan/goals` — PLAN (`/plan` normalizes to `/plan/tasks`)
- `/live`, `/live/habits`, `/live/calendar`, `/live/matrix`, `/live/heatmap`, `/live/fitness` — LIVE (`/live` normalizes to `/live/calendar`)
- `/think` — THINK
- `/statistics` — STATISTICS
- `/settings` — SETTINGS

Unknown routes display a recoverable route-not-found state, primary links use semantic `<a href>` navigation preserving modified-click new-tab behavior, and browser Back/Forward navigation works natively via `popstate`.

---

## 4. Target Full-Stack Architecture (Phases 3–12)

```
┌───────────────────────────┐       HTTPS / JSON        ┌────────────────────────────────┐
│   React + Vite Client     │ ─────────────────────────► │   Express API (server.ts)      │
│                           │                            │                                │
│ • Feature UI Modules      │                            │ • Auth Middleware (Firebase)   │
│ • Data Boundary Hooks     │                            │ • Zod Request Validators       │
│ • API Client Services     │                            │ • Controllers & Domain Svcs    │
└───────────────────────────┘                            │   ├── PlanService (Tasks/Cal)  │
                                                         │   ├── LiveService (Habits/Strk)│
                                                         │   ├── StatsService             │
                                                         │   └── ThinkOrchestrator (Ph 11)│
                                                         └───────────────┬────────────────┘
                                                                         │ Drizzle ORM
                                                                         ▼
                                                         ┌────────────────────────────────┐
                                                         │      PostgreSQL Database       │
                                                         │ • Strict user_id ownership     │
                                                         │ • Historical habit_logs        │
                                                         │ • Local-date vs UTC separation │
                                                         └────────────────────────────────┘
```

### Server Entry Strategy (Deferred to Phase 3)
When backend persistence starts in Phase 3, `server.ts` will boot Express on port `3000`, mount `/api/*` routes with Zod validation and service layers, attach `vite.middlewares` in development (`"dev": "tsx server.ts"`), and register a catch-all SPA fallback after `/api/*` routes so direct refreshes on nested client paths (`/live/matrix`, `/plan/goals`, etc.) always return `index.html`. We intentionally avoid scaffolding empty Express routes in Phase 1 so there is no dead backend code or misleading mock endpoints.
