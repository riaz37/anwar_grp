"use client";

import { useEffect } from "react";

/**
 * Scroll-triggered entrance for anything marked `data-reveal`.
 *
 * The whole effect is CSS (`globals.css` > Marketing motion); this component
 * only decides *when* each element crosses the threshold. Two deliberate
 * properties:
 *
 *   1. **Fails visible.** The hidden state is scoped to `.reveal-armed` on
 *      <html>, which is added here on mount. If the bundle never loads, an
 *      older browser lacks `IntersectionObserver`, or the user prefers reduced
 *      motion, the class is never added and every section renders at its
 *      resting state. Nothing on this page can be hidden by a failed script.
 *   2. **One-way.** An element that has appeared is unobserved and never
 *      re-hidden, so scrolling back up does not replay the page.
 *
 * The page itself stays a Server Component; this mounts alongside it purely
 * for the observer.
 */
export function ScrollReveal() {
  useEffect(() => {
    const root = document.documentElement;

    if (
      typeof IntersectionObserver === "undefined" ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }

    const targets = Array.from(
      document.querySelectorAll<HTMLElement>("[data-reveal]"),
    );
    if (targets.length === 0) return;

    root.classList.add("reveal-armed");

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.setAttribute("data-revealed", "");
          observer.unobserve(entry.target);
        }
      },
      // Fire a little before the element reaches the fold, so the transition
      // has finished by the time it is properly in view rather than starting
      // there and reading as lag.
      { rootMargin: "0px 0px -12% 0px", threshold: 0.05 },
    );

    for (const target of targets) {
      // Anything already on screen at mount (the masthead) is revealed on the
      // next frame rather than observed, so it never flashes hidden.
      if (target.getBoundingClientRect().top < window.innerHeight) {
        requestAnimationFrame(() => target.setAttribute("data-revealed", ""));
        continue;
      }
      observer.observe(target);
    }

    return () => {
      observer.disconnect();
      root.classList.remove("reveal-armed");
    };
  }, []);

  return null;
}
