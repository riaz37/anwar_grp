/**
 * Purely decorative aurora behind the landing-page masthead.
 *
 * Every `rgba(240, 251, 103, …)` below is one blurred light source at a
 * different alpha — that is `--primary-med` (#f0fb67), the single brand
 * pigment, expressed at opacities no token names. There is no
 * "accent at 22%" role in DESIGN.md and inventing six would be worse than
 * hardcoding the paint here, where it is obviously a light rig and not a
 * semantic colour. The `rgba(0,0,0,…)` stops are mask alphas, not paint.
 *
 * Contrast safety: this sits *behind* content with `pointer-events-none` and
 * `aria-hidden`, and the whole rig is dimmed hard in light mode, where a lime
 * wash over white would eat the 4.5:1 the body copy needs (DESIGN.md §9).
 */
export function GlowField() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[min(120vh,1100px)] overflow-hidden [[data-theme=light]_&]:opacity-25"
    >
      <div className="glow-parallax absolute top-[-380px] right-[-260px] h-[1000px] w-[760px] will-change-transform">
        <div className="absolute inset-0 rounded-full bg-[rgba(240,251,103,0.2)] blur-[180px]" />

        <div
          className="absolute inset-0 opacity-60"
          style={{
            maskImage:
              "radial-gradient(circle at 82% 18%, rgba(0,0,0,0.95) 22%, transparent 62%)",
            WebkitMaskImage:
              "radial-gradient(circle at 82% 18%, rgba(0,0,0,0.95) 22%, transparent 62%)",
            backgroundImage:
              "conic-gradient(from -28deg at 74% 2%, rgba(240,251,103,0.5) 0deg, rgba(240,251,103,0.28) 18deg, transparent 56deg, transparent 360deg)",
          }}
        />

        <div
          className="absolute top-[60px] left-[-60px] h-[760px] w-[520px] opacity-50"
          style={{
            backgroundImage:
              "conic-gradient(from -62deg at 90% 10%, rgba(240,251,103,0.3) 0deg, rgba(240,251,103,0.1) 22deg, transparent 72deg)",
            filter: "blur(30px)",
          }}
        />

        <div
          className="absolute top-[200px] left-[-90px] h-[640px] w-[460px] opacity-40"
          style={{
            mixBlendMode: "screen",
            backgroundImage:
              "repeating-linear-gradient(118deg, rgba(240,251,103,0.3) 0px, rgba(240,251,103,0.3) 12px, transparent 12px, transparent 44px)",
            transform: "skewX(-6deg)",
            filter: "blur(26px)",
            maskImage:
              "linear-gradient(115deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.85) 38%, rgba(0,0,0,0.25) 72%, transparent)",
            WebkitMaskImage:
              "linear-gradient(115deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.85) 38%, rgba(0,0,0,0.25) 72%, transparent)",
          }}
        />
      </div>

      {/* Counter-glow on the opposite corner, so the masthead is lit from two
          directions and the composition does not lean entirely right. */}
      <div className="absolute top-[240px] left-[-320px] h-[620px] w-[620px] rounded-full bg-[rgba(240,251,103,0.07)] blur-[170px]" />
    </div>
  );
}
