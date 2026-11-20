# Marly — Design System Specification

## 1. Design Philosophy

Marly is **dark-first, calm, minimal, and tactile**. It avoids loud gradients, glassmorphic clutter, neon glows, and crowded badge clouds. Every color carries a deliberate semantic role across Marly's pillars.

---

## 2. Color Tokens (60-30-10 Discipline)

### Neutral Surfaces (90% of Visual Field)
| Token | Hex | Usage |
| :--- | :--- | :--- |
| `--color-canvas` | `#151515` | Primary application backdrop with subtle 24px radial dot matrix |
| `--color-surface` | `#202020` | Primary panel / card surface (single-elevation depth) |
| `--color-elevated` | `#292929` | Interactive list rows, inputs, hover highlights |
| `--color-hairline` | `rgba(255,255,255,0.08)` | 1px card and section dividers |

### Typography Ink Tokens
| Token | Hex | Usage |
| :--- | :--- | :--- |
| `--color-ink-primary` | `#F2F2F2` | Primary headings, active navigation, task titles |
| `--color-ink-secondary` | `#A3A3A8` | Subtitles, descriptions, inactive navigation |
| `--color-ink-muted` | `#737378` | Timestamps, secondary metadata, unscheduled days |
| `--color-ink-on-accent` | `#151515` | High-contrast dark ink on Coral, Mint, and Blue highlight cards |

### Semantic Pillar Accents (10% Accent Budget)
| Token | Hex | Pillar / Semantic Role |
| :--- | :--- | :--- |
| `--color-coral` | `#E59585` | **PLAN** — Today focus card, active calendar block, priority emphasis |
| `--color-mint` | `#96D2C5` | **LIVE** — Habit completion, positive progress bars, intention card |
| `--color-orange` | `#F19A50` | **Streaks & Activity** — Flame streak metrics, yearly heatmap ramp, partial progress |
| `--color-blue` | `#A9C8E9` | **Secondary Info** — Upcoming check-ins, schedule highlights |
| `--color-purple` | `#8C82E8` | **THINK** — Reserved exclusively for AI layer previews and Phase 11 tools |

---

## 3. Typography

- **Primary UI & Display Face:** `Manrope` (weights `400`, `500`, `600`, `700`) with `+0.01em` optical tracking on dark surfaces and `text-wrap: balance` on display titles.
- **Numeric & Temporal Face:** `JetBrains Mono` with `font-variant-numeric: tabular-nums` on all percentages, completion ratios (`2/7`), dates, streak counts, and schedule times (`09:00`).

---

## 4. Component & Layout Rules

1. **Zero-Pill Metadata Discipline:** Static metadata (categories, timestamps, durations, phase notices) renders as clean inline text separated by `·` or `/`, never wrapped in rounded capsule pills. Pill/segmented styling is reserved for interactive filter controls (`<button>`).
2. **Single-Elevation Depth:** Never nest bordered rounded cards inside larger bordered cards. Separate internal groups with whitespace and `1px` hairline dividers (`border-white/[0.08]`).
3. **No Hue-Only State Signaling:** Every status color (Completed, Partial, Missed, Preview) pairs color with an explicit icon or text label for accessibility.
4. **Touch & Focus Accessibility:** Visible `focus-visible` outlines (`#E59585` or `#96D2C5`), minimum `40px` desktop / `44px` mobile touch targets, and `prefers-reduced-motion` support.

---

## 5. Phase 1 Reusable UI Kit (`src/components/ui/`)

- `Button` & `IconButton` (Primary, Secondary, Ghost, Coral, Mint, Danger variants; `sm`, `md`, `lg` sizes)
- `Card` (`default`, `elevated`, `coral`, `mint`, `blue`, `purple-subtle` surface variants)
- `Input` (accessible label, leading icon, clear button, error text)
- `Checkbox` (circular and square variants with accessible `aria-checked` state)
- `ProgressBar` & `ProgressRing` (smooth CSS width/stroke transitions with tabular percentage display)
- `Badge` (restrained semantic status label with explicit icon, used sparingly for status/phase tags)
- `SegmentedTabs` (interactive filter tabs and sub-navigation switcher)
- `Dialog` (keyboard-accessible modal with Escape/backdrop dismissal)
- `Toast` (non-blocking bottom-right notification stack with honest demo/action feedback)
- `EmptyState`, `Skeleton`, and `ErrorState` (first-class UI state primitives demonstrated interactively in Settings -> UI States)
