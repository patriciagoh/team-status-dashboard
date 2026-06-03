# Accessibility — Team Status Dashboard

Target: WCAG 2.2 Level AA.

## Inherited from matcha-oat

- Green text uses `--matcha-deep` (not `--matcha`), which provides sufficient contrast on all app backgrounds.
- Focus ring via `var(--focus)` (2px solid `--matcha-deep`) on all interactive elements, applied through the `.tsd-focus` utility class.
- `prefers-reduced-motion` disables the snapshot pulse animation (`.tsd-pulse`) and the row-open slide transition.
- Warm palette tokens (`--paper`, `--oat`, `--ink`, `--ink-2`, `--muted`) are AA-verified upstream.

## Use of color (WCAG 1.4.1)

Every work category is conveyed as a text label in the chip and in the summary-strip tally — never by hue alone. A person with low-confidence inference is shown with italic serif text, a `~` prefix on the "what" field, and a dashed-border text tag ("inferred · low confidence"), not a colour change.

## Keyboard / Screen Reader

- Person rows are rendered as `<button aria-expanded aria-controls>` elements. Each button's `aria-controls` value matches the `id` of the expanded `<div>` panel beneath it.
- The expanded panel `<div>` carries the matching `id` so assistive technology can navigate from button to panel.
- Decorative status dots and the expand/collapse arrow glyphs carry `aria-hidden="true"`.

## Chip contrast ratios (measured 2026-06-03)

All ratios computed with the WCAG relative-luminance formula (IEC 61966-2-1 gamma). Threshold for normal text: **4.5:1**.

| Category   | Text colour | Background  | Ratio  | Result |
|------------|-------------|-------------|--------|--------|
| support    | `#6C6647`   | `#EDEADD`   | 4.80:1 | PASS   |
| lent       | `#4C483E`   | `#F1EFE9`   | 7.93:1 | PASS   |
| incident   | `#9A3D29`   | `#F6E2DA`   | 5.47:1 | PASS   |
| unplanned  | `#6A5320`   | `#FBEDC6`   | 6.28:1 | PASS   |
| adhoc      | `#4C483E`   | `#FFFFFF`   | 9.12:1 | PASS   |
| planned    | `#4E6B3A`   | `#EDF1E5`   | 5.25:1 | PASS   |

No token adjustments were required; all six pairs exceed 4.5:1.
