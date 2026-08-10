---
name: feel-lab
description: A catalogue of 41 perceived-performance and interface-craft techniques that make an app feel faster without changing how fast it actually is — skeletons, optimistic UI, spring physics, the Doherty threshold, and more. Invoke with /feel-lab.
disable-model-invocation: true
---

# Feel Lab

A reference catalogue of 41 techniques for **perceived** performance. The thesis: nothing here makes an app faster; everything here makes it *feel* faster. Each technique has a real off-state — the point is always the contrast between "trick on" and the bare interaction underneath.

## When to apply

This skill only runs when you invoke it with `/feel-lab` — the model won't auto-trigger it. Once running: pick the technique(s) that fit the problem, name them, and give the one-line mechanism + the failure mode to avoid. Don't dump the whole list unless asked. Reach for the target numbers in **Perception** first — they're what every other technique is chasing.

## The catalogue

**Waiting** — cheat the user's clock, not the machine's.
- **1. Skeleton screens** — grey layout ghost, not a spinner; the shimmer sweep says "working," static grey says "frozen."
- **2. Optimistic UI** — paint success before the server confirms, reconcile/roll back on failure. The cost only shows on a real error.
- **3. Blur-up images** — inline a ~1KB thumbnail, blur it, cross-fade the full file over it. Never show an empty rectangle.
- **4. Prefetch on hover** — spend the 200–300ms between hover and click fetching; the click resolves against memory.
- **5. Streaming** — flush the shell first, fill holes as data resolves. Same total time, readable far sooner.
- **6. Virtual lists** — render only the ~20 visible rows of 10,000, keep a tall spacer, recycle on scroll.
- **7. Debounce** — wait for a ~300ms typing pause before firing; one request instead of eleven stale ones.
- **8. Code splitting + quiet prefetch** — ship only this screen's JS, pull the next likely screen during idle time.
- **9. Keep it in memory** — the meta-trick: delete the loading state; render from a client cache, sync in the background.

**Motion** — motion explains what just happened to what.
- **10. Spring physics** — springs overshoot and settle like objects with mass; easing curves stop dead. Use a real sim (stiffness ~170, damping ~16).
- **11. Shared-element transitions** — the thumbnail *becomes* the detail view via FLIP (First-Last-Invert-Play); the eye tracks one object.
- **12. Stagger** — offset items ~40ms each so entrance reads as composed, not dumped. Keep the total under ~350ms.

**Hands** — patterns borrowed back from phones.
- **13. Drag to dismiss** — throw a sheet away with resistance + a velocity threshold; closing stops being a target to hit.
- **14. Swipe actions** — hide frequent/destructive actions under the row; commit past ~40%, else spring back.
- **15. Long press** — a menu that costs nothing until asked for; the progress fill is mandatory, not decoration.
- **16. Command palette (⌘K)** — every action, one keystroke, from anywhere. Table stakes for daily-use tools.

**Surfaces** — stop a screen from looking like a screen.
- **17. Glass** — backdrop blur PLUS `saturate(150%)`; blur alone goes muddy grey.
- **18. Layered shadows** — stack three (tight+dark, medium, wide+faint); one shadow reads as a smudge.
- **19. Grain** — an inline `feTurbulence` SVG noise layer breaks gradient banding for a few hundred bytes.
- **20. Mesh gradients** — 4–5 radial-gradient color points bleeding together; organic, not ruled.
- **21. Dark mode done right** — sit on ~#121212 not #000; elevate cards by getting *lighter*, not by shadow; desaturate accents.

**Layout & type** — where a page gets its posture.
- **22. Editorial headline** — oversized, tight tracking (~-0.03em at display size only), mixed weights within one line.
- **23. Bento grid** — deliberately different cell sizes in one grid; size says what matters without a heading.
- **24. Parallax depth** — layers at slightly different scroll speeds read as distance. A few percent = atmosphere; a lot = nausea.
- **25. Scroll reveal** — fade/rise elements as they enter view via one `IntersectionObserver`, never a scroll listener.

**Micro** — the one-second details.
- **26. Button feedback** — press compresses ~2–3% and brightens; scale *down*, never up (up reads as escaping the press). Ripple from the touch point.
- **27. Focus states / floating labels** — label lifts to a caption, border takes the accent, soft ring appears. Keep the ring — it's the only orientation a keyboard user has.
- **28. Hover cards + counting numbers** — preview on hover; ease-out a counter to its real value and stop (a still-climbing number is noise).
- **29. Toast, not modal** — "Saved" is information, not a decision; a toast leaves on its own. Reserve modals for genuine forks/destruction.

**Input** — how fast the interface answers *you*, not itself.
- **30. Instant tap** — `touch-action:manipulation` kills the legacy ~300ms tap delay. Biggest single "web vs native" tell.
- **31. Typing that keeps up** — keep a field's paint off the critical path; defer heavy work (e.g. `requestIdleCallback`) so the character lands first. This is INP.
- **32. Yield mid-task** — slice long jobs and `scheduler.yield()` between chunks so a click during the work still registers (React concurrent mode's idea).
- **33. Passive scroll listeners** — register `{passive:true}` so the browser scrolls on the compositor without waiting on your JS.

**Perception** — the theory the rest of the page chases; reach for these targets before any specific tactic.
- **34. Doherty threshold** — the targets: ≤100ms feels instant; ~400ms attention slips; ≥1000ms you've lost them. Everything else is a tactic to hit these.
- **35. Fake progress** — an ease-out bar (fast then slow, snap to 100% on finish) feels faster than a truthful linear one over the identical wait.
- **36. Min-display spinner** — don't show a loader before ~200ms of wait; once shown, hold it ≥~400ms. Fast loads show nothing; slow loads never strobe.

**Loading craft** — get the cure right so it isn't the disease.
- **37. Stale-while-revalidate** — paint the last known value instantly, fetch fresh in the background, swap in (SWR / TanStack Query).
- **38. Reserve space (anti-CLS)** — give async elements their final dimensions up front (`aspect-ratio`) so content never jumps under a finger. The worst "slow" feeling is motion, not latency.

**Senses** — feel beyond the eyes.
- **39. Haptics** — a ~10ms `navigator.vibrate()` on success lands before any pixel; confirms via a channel the eyes aren't using. Mobile only.
- **40. Sound** — one synthesized Web Audio earcon on the action that matters. Rare and quiet, or it's a toy.
- **41. `font-display:swap`** — show a system-font fallback immediately, swap the web font in when it arrives. A flash of unstyled text beats a flash of no text (FOUT > FOIT).

## Output format

Name each technique used, give its one-line mechanism, and state the failure mode / the number to hit. Prefer 2–4 relevant techniques over the whole list. If the user wants to *see* them, point to the live demo page (`feellab.html`) where every technique has a working on/off switch.