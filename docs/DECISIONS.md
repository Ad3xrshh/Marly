# Marly — Architectural Decisions Log (ADRs)

---

## ADR-001: Persistent Sidebar + Compact Top Utility Bar on Desktop
- **Date:** Phase 0 / Phase 1
- **Status:** Confirmed
- **Decision:** Use a persistent `240px` left sidebar for primary pillar navigation (`Home`, `Plan`, `Live`, `Think`, `Statistics`, `Settings`) combined with a `64px` top utility bar (`Page Title`, `Search`, `Quick Add`, `Demo Indicator`), collapsing to a drawer/rail on tablet and a fixed bottom bar on mobile.
- **Rationale:** Scales cleanly as **PLAN** and **LIVE** gain deep sub-views (Tasks, Calendar, Projects, Goals, Habit Calendar, Matrix, Heatmap, Fitness) without crowding a single horizontal top bar.

## ADR-002: Typography Pairing — Manrope + JetBrains Mono
- **Date:** Phase 0 / Phase 1
- **Status:** Confirmed
- **Decision:** Use `Manrope` for headings, navigation, and body text, paired with `JetBrains Mono` (`tabular-nums`) for all numeric counters, streaks, percentages, and timestamps.
- **Rationale:** `Manrope` gives Marly a warm, modern geometric tone that reads crisply on `#151515`/`#202020` dark surfaces, while `JetBrains Mono` guarantees vertical alignment in matrices, calendars, and progress ratios.

## ADR-003: Target Persistence Stack — PostgreSQL + Drizzle ORM
- **Date:** Phase 0
- **Status:** Confirmed (Implementation deferred to Phase 3)
- **Decision:** Target PostgreSQL with Drizzle ORM for backend persistence when Phase 3 begins, keeping Phase 1 strictly client-side with isolated demonstration data.
- **Rationale:** Marly's interconnected entities (tasks, goals, milestones, historical habit logs, workouts) benefit from strict relational constraints and explicit SQL aggregations. Deferring installation prevents unused dependency bloat during UI shell construction.

## ADR-004: Zero-Dependency URL-Aware Routing in Phase 1
- **Date:** Phase 1
- **Status:** Confirmed
- **Decision:** Implement a lightweight TypeScript History API router (`src/lib/router.ts`) supporting nested paths (`/plan/*`, `/live/*`, `/think`, `/statistics`, `/settings`) instead of introducing `react-router` immediately or using non-URL local tab state.
- **Rationale:** Gives users real browser Back/Forward navigation and shareable route paths without adding external routing overhead in Phase 1.

## ADR-005: Honest Demonstration Isolation
- **Date:** Phase 1
- **Status:** Confirmed
- **Decision:** Store Phase 1 demo records in `src/data/` and wrap interactive shell toggles in `DemoStateContext` with visible `Demo Preview` indicators and a one-click reset action. Never fake API calls or database persistence.
- **Rationale:** Maintains developer and user trust while allowing tactile verification of the 3-column Home layout, Monthly Habit Calendar, Weekly Matrix, and Activity Heatmap.

## ADR-006: Deferred Decisions (Intentionally Open)
- **Authentication Provider Configuration:** Firebase Auth integration deferred until Phase 3+ backend routes are built.
- **Charting Library Adoption:** `recharts` deferred to Phase 9 (Unified Statistics); Phase 1 uses lightweight custom SVG/CSS bars for the Home 7-day preview and Live heatmap trends.
- **Notification Delivery Mechanism:** Push/email/local notification strategy deferred until task and habit schedules exist in backend services.
- **THINK AI Tool Schema:** Gemini function-calling contract (`@google/genai`) deferred to Phase 11 after PLAN and LIVE services stabilize.
