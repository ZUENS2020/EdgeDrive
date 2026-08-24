# EdgeDrive v2 Design System

The interface uses industrial minimalism with geometric order and precise warmth. It is intentionally flat: no gradients, decorative blur, elevation shadows or layout-shifting hover motion.

## Structure

- Desktop: 64px primary rail + 256px contextual panel + fluid content canvas.
- Mobile below 768px: 56px top bar and an explicit two-part navigation drawer.
- Content widths cap at 1240px with adaptive 24–64px desktop gutters and 15px mobile gutters.
- Breakpoints verified at 375, 768, 1024 and 1440px; mobile portrait and landscape must not overflow horizontally.

## Themes

| Theme | Background | Surface | Rail | Text | Accent |
|---|---|---|---|---|---|
| Onyx | `#E9E7E1` | `#F8F6F0` | `#171B1B` | `#171A19` | `#9A5637` |
| Porcelain | `#F3F0E8` | `#FBF8F0` | `#D9D5CC` | `#191C1B` | `#405B56` |
| Nocturne | `#111514` | `#1C2220` | `#090C0B` | `#E7E2D8` | `#BD7651` |

Semantic tokens in `src/app/globals.css` are authoritative. Public transfer pages use the Nocturne palette to create a focused, immersive viewing surface.

## Typography and density

- System sans stack: Inter where available, then SF Pro, PingFang SC, Noto Sans SC and system UI.
- Monospace labels and numeric data use SFMono/Consolas fallbacks.
- Headings use compact negative tracking; body copy keeps a 1.5–1.75 line height.
- Spacing follows a 4/8px rhythm. Dense catalog rows remain at least 62px high.
- Mobile form controls use 16px text to prevent browser zoom.

## Interaction

- Lucide outline icons only; no emoji icons.
- State transitions are 150–180ms and limited to color, opacity and transform on the mobile drawer.
- Focus is a visible 2px semantic ring with 2px offset.
- Mobile controls and public share actions are at least 44×44px.
- Loading uses a compact spinner or determinate transfer progress; no decorative continuous animation.
- `prefers-reduced-motion` collapses transition and animation durations.

## Components

- Buttons: 1px border, 0–4px radius, stable bounds. One accent primary action per area.
- Panels: flat semantic surface with 1px border; never use shadow for hierarchy.
- Tables: line-separated rows, type/size/status/date hierarchy and actions revealed on hover but always available by keyboard/mobile.
- Dialogs: 58% black scrim, bordered flat panel, visible close and cancel paths.
- Public previews: dark stage, fixed readable viewport, safe Markdown/text rendering and a separate transfer manifest.

## Accessibility checklist

- Sequential headings and a skip-to-content link.
- Visible form labels and descriptive names for icon-only controls.
- Status always includes text in addition to color.
- Primary text targets WCAG 4.5:1; secondary text targets 3:1 in all three themes.
- Keyboard focus order follows the visual rail → context → main sequence.
- Mobile layouts preserve zoom, avoid horizontal overflow and reserve space for fixed navigation.
