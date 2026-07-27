import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";

gsap.registerPlugin(ScrollTrigger, SplitText);
gsap.defaults({ duration: 0.6, ease: "power3.out" });

const mm = gsap.matchMedia();
mm.add({ motionOK: "(prefers-reduced-motion: no-preference)" }, (ctx) => {
  if (!ctx.conditions!.motionOK) return;

  // Remove the anti-flash guard synchronously, before any tween is created,
  // so gsap.from() doesn't capture its end values while opacity is still 0.
  // The from-tweens' immediateRender re-hides the items within this same
  // task, before paint, so there is no flash.
  document.documentElement.classList.remove("js-motion");

  // 1. Hero timeline
  const heroTl = gsap.timeline();

  SplitText.create("[data-hero]", {
    type: "lines",
    mask: "lines",
    autoSplit: true,
    onSplit: (self) => {
      const tween = gsap.from(self.lines, {
        yPercent: 110,
        autoAlpha: 0,
        stagger: 0.07,
        duration: 0.6,
        ease: "power3.out",
      });
      heroTl.add(tween);
      return tween;
    },
  });

  heroTl.from(
    gsap.utils.toArray<HTMLElement>("[data-hero-item]:not([data-hero])"),
    { autoAlpha: 0, y: 12, stagger: 0.08, duration: 0.5, ease: "power3.out" },
    "-=0.3"
  );

  // 2. Reveals
  gsap.utils.toArray<HTMLElement>("[data-reveal]").forEach((el) => {
    gsap.from(el, {
      autoAlpha: 0, y: 12,
      scrollTrigger: { trigger: el, start: "top 85%", once: true },
    });
  });

  // 3. Stage rules
  gsap.utils.toArray<HTMLElement>("[data-stage-rule]").forEach((el) => {
    gsap.from(el, {
      scaleX: 0,
      duration: 0.8,
      ease: "power2.out",
      scrollTrigger: { trigger: el, start: "top 90%", once: true },
    });
  });

  // 4. Timeline blocks — grouped by their shared parent so each panel's
  // bars stagger together off one ScrollTrigger.
  const timelinePanels = new Map<Element, HTMLElement[]>();
  gsap.utils.toArray<HTMLElement>("[data-timeline-block]").forEach((el) => {
    const panel = el.parentElement!;
    if (!timelinePanels.has(panel)) timelinePanels.set(panel, []);
    timelinePanels.get(panel)!.push(el);
  });
  timelinePanels.forEach((blocks, panel) => {
    gsap.from(blocks, {
      scaleX: 0,
      transformOrigin: "left center",
      stagger: 0.12,
      scrollTrigger: { trigger: panel, start: "top 75%", once: true },
    });
  });
});

// 5. Parallax — desktop only. Kept in its own matchMedia context so
// resizing across the 768px breakpoint doesn't revert/replay the hero
// timeline and [data-reveal] sections above.
mm.add(
  { motionOK: "(prefers-reduced-motion: no-preference)", desktop: "(min-width: 768px)" },
  (ctx) => {
    if (!ctx.conditions!.motionOK || !ctx.conditions!.desktop) return;

    gsap.utils.toArray<HTMLElement>("[data-parallax]").forEach((fig) => {
      const img = fig.querySelector("img");
      if (!img) return;
      gsap.fromTo(
        img,
        { yPercent: -4 },
        {
          yPercent: 4,
          ease: "none",
          scrollTrigger: { trigger: fig, start: "top bottom", end: "bottom top", scrub: 0.5 },
        }
      );
    });
  }
);
