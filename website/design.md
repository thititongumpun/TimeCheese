# Design — TimeCheese website

A locked design system for this site. Every page redesign reads this file before
emitting code. Do not regenerate per page — extend or amend this file when the
system needs to grow.

## Genre

precision-instrument (engineering-journal / blueprint-schematic language on a light
paper canvas)

## Provenance

Custom system, designed from scratch for the site's v4 "Blueprint" rebuild
(2026-07-27) — not adapted from an external reference. It takes its cues from
engineering drawings and technical documentation: light paper, hairline rules,
a high-contrast serif display paired with a plain sans body, precise structural
grids. No DNA extraction; theme, type pairing and the GSAP motion language
below are original decisions for this brief.

## Macrostructure family

- Marketing page (`src/pages/index.astro`): **Narrative Workflow** — a single
  scroll-driven story: hero, feature stages each paired with a real product
  screenshot, a CSS-built day-timeline graphic, a spec-sheet comparison table
  (hairline rules), then download. No poster/marquee/carnival framing.
- Content pages (`src/pages/docs/*`, `changelog.astro`): **Long Document** — quiet
  prose; decoration limited to the shared chrome (nav/footer rules). Leave alone.

## Theme

Brand tokens, canonical in `src/styles/global.css` `@theme` (light default +
`html[data-theme='dark']` override).

- `--color-paper` `#F4F5F7` / dark `#0B0E14` — page background
- `--color-panel` `#FFFFFF` / `#131822` — card/table surface
- `--color-rule` `#D8DCE3` / `#242C3A` — hairline borders
- `--color-ink` `#10141C` / `#E8ECF4` — body/heading text
- `--color-muted` `#5C6675` / `#8A94A6`
- `--color-accent` `#2F4BFF` / `#6E86FF` — ultramarine
- `--color-accent-deep` `#1B2CB8` / `#9DAEFF` — pressed/hover state
- `--color-on-accent` `#FFFFFF` / `#0B0E14`
- `--color-signal` `#FF5A1F` / `#FF7A45` — signal orange, non-text emphasis only
- `--color-signal-ink` `#C23A00` / `#FF9A6B`

**Signal-orange rule:** `--color-signal` never carries body copy, links, or CTA
fills — it marks (small accents, table ticks) only. Ultramarine is the sole
interactive/text accent.

## Typography

- Display: Fraunces Variable, 700, roman only — no italic anywhere, including
  emphasis (use weight or color instead). High-contrast serif for headings.
- Body: Instrument Sans Variable, 400 (`--font-sans`). Sentence case, short
  paragraphs.
- Mono: JetBrains Mono Variable (`--font-mono`) — labels, version strings,
  timestamps, and spec-sheet numerals (`tabular-nums`).

## Decoration language

Structural/hairline only — no ornaments, no shadows, no fake chrome.

1. **Hairlines** — `1px solid var(--color-rule)` for card borders, table
   rules, and stage dividers (`data-stage-rule`). No 2px rules, no offset
   shadows anywhere.
2. **No typographic ornaments** — no star, diamond, flourish, or similar
   decorative glyphs.
3. **No `box-shadow`** — flat panels read through `--color-panel` fill plus a
   hairline border, never elevation.
4. **No fake browser/phone/IDE chrome, no invented metrics or testimonials** —
   real product screenshots (`.shot`, click-to-zoom lightbox) are the imagery,
   plus one Tier-A CSS-built day-timeline graphic.

## Spacing

Tailwind default 4-pt utility scale. Varied section rhythm; hairline
`data-stage-rule` dividers carry the transitions instead of borders.

## Motion

GSAP 3.15.0 (`src/scripts/motion.ts`), gated entirely behind one
`gsap.matchMedia()` call keyed on `(prefers-reduced-motion: no-preference)` —
when that query doesn't match, the callback returns immediately and zero
tweens/ScrollTriggers are created. Plugins used: **ScrollTrigger** and
**SplitText** (both free in the public GSAP package).

`data-*` attribute contract (motion.ts queries these; markup owns them):

- `data-hero` — the hero heading; split into lines (`SplitText`) and revealed
  with a stagger as part of the hero-open timeline.
- `data-hero-item` — every element in the above-the-fold hero block; hidden
  via `html.js-motion [data-hero-item] { opacity: 0 }` (that class is added by
  an inline head script only when motion is allowed) and revealed by the hero
  timeline.
- `data-reveal` — generic scroll-in reveal (fade/`y` shift), one-shot
  ScrollTrigger per element.
- `data-stage-rule` — hairline dividers between stages; scale-x in from a
  ScrollTrigger.
- `data-timeline-block` — bars of the CSS day-timeline graphic; grouped by
  shared parent and staggered off one ScrollTrigger per panel.
- `data-parallax` — desktop-only (`min-width: 768px`) image parallax inside a
  scrubbed ScrollTrigger.

Reduced motion is enforced twice over: the `matchMedia` gate above stops
motion.ts from creating anything, and `src/layouts/Base.astro`'s inline head
script only adds the `js-motion` class (which is what makes `[data-hero-item]`
start hidden) when `(prefers-reduced-motion: reduce)` does not match. A
blanket `@media (prefers-reduced-motion: reduce)` rule at the end of
`global.css` also forces every remaining CSS transition/animation to
near-zero duration as a safety net.

## Microinteractions stance

- Silent success; no toasts.
- Focus ring: instant, `2px solid var(--color-accent)`, offset 2px.

## CTA voice

- Primary: filled `--color-accent`, `border border-accent-deep`, flat (no
  shadow), `px-4 py-2 text-sm font-medium text-[--color-on-accent]`.
- Secondary: `border border-rule`, same geometry, hover → accent border + text.
- Every nav link, footer link and CTA label is `whitespace-nowrap`; every
  button/CTA hit target is `min-h-11`.

## Icons

None. No typographic ornaments. No emoji, no wordmark glyph — decoration is
carried by hairline rules, weight, and the single accent.

## Nav / footer archetypes

- Nav: **N12** banner + retract — a slim mono announcement banner (release
  version + "What's new") sits above a standard bar; the banner retracts
  (`translateY`) on scroll-down, reappears on scroll-up, dismissible with a
  `×` button. Banner text truncates (`text-ellipsis`) rather than wrapping on
  narrow screens.
- Footer: **Ft4** dense colophon — one small mono-set line: product name,
  version, and links, in `--color-muted`.

## What pages MUST share

Wordmark, duo-tone accent discipline, fonts, CTA voice, the token set above.

## Exports

Canonical format is the Tailwind v4 `@theme` block in `src/styles/global.css`.
DTCG / shadcn exports intentionally omitted (Astro-only project).
