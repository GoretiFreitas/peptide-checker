import { useEffect, useId, useRef, type CSSProperties } from "react";

/**
 * Fluid layered backdrop.
 *
 * The brand artwork is a peach-to-coral gradient with pearl molecule clusters
 * and flowing wave bands. A single raster cannot carry that across a page of
 * arbitrary length, so the wave system is rebuilt in SVG: each band tiles
 * seamlessly, drifts sideways on its own clock, and parallaxes vertically at
 * its own rate. The photographic artwork stays as the hero atmosphere and
 * scrolls away, handing off to the wave system at the fold.
 *
 * Composition, back to front:
 *   0  gradient wash            static
 *   1  hero artwork             scrolls away (speed ~1), fades at its base
 *   2  deep wave band           slowest, most transparent
 *   3  mid wave band            counter-drifts against the deep band
 *   4  pearl molecule cluster
 *   5  near wave band           fastest, most saturated
 *   6  legibility wash          light; content sits on frosted panels
 */

interface Layer {
  speed: number;
  /** Decorative layers clamp so they never slide their own edge into view. */
  clamp: boolean;
}

const LAYERS = {
  hero: { speed: 0.92, clamp: false },
  deep: { speed: 0.06, clamp: true },
  mid: { speed: 0.13, clamp: true },
  pearls: { speed: 0.2, clamp: true },
  near: { speed: 0.26, clamp: true },
} satisfies Record<string, Layer>;

type LayerName = keyof typeof LAYERS;

/** Clamp decorative travel to this fraction of viewport height. */
const MAX_OFFSET_RATIO = 0.28;

export function ScientificBackground() {
  const refs = useRef(new Map<LayerName, HTMLDivElement | null>());

  const setRef = (name: LayerName) => (node: HTMLDivElement | null) => {
    refs.current.set(name, node);
  };

  useEffect(() => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;

    const paint = () => {
      frame = 0;
      const scrolled = window.scrollY;
      const maxOffset = window.innerHeight * MAX_OFFSET_RATIO;

      for (const [name, config] of Object.entries(LAYERS) as Array<[LayerName, Layer]>) {
        const element = refs.current.get(name);
        if (!element) continue;
        const raw = scrolled * config.speed;
        const offset = config.clamp ? Math.min(raw, maxOffset) : raw;
        element.style.transform = `translate3d(0, ${(-offset).toFixed(2)}px, 0)`;
      }
    };

    const onScroll = () => {
      if (frame || reducedMotion.matches) return;
      frame = window.requestAnimationFrame(paint);
    };

    const sync = () => {
      if (reducedMotion.matches) {
        if (frame) {
          window.cancelAnimationFrame(frame);
          frame = 0;
        }
        for (const element of refs.current.values()) {
          if (element) element.style.transform = "";
        }
        return;
      }
      paint();
    };

    sync();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", sync, { passive: true });
    reducedMotion.addEventListener("change", sync);

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", sync);
      reducedMotion.removeEventListener("change", sync);
    };
  }, []);

  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden select-none" aria-hidden>
      {/* 0 — gradient wash */}
      <div className="brand-wash absolute inset-0" />

      {/* 1 — hero artwork, scrolls away and hands off to the waves */}
      <div ref={setRef("hero")} className="parallax-hero">
        <div className="brand-hero-art h-full w-full" />
      </div>

      {/* 2 — deep wave band */}
      <WaveBand
        layerRef={setRef("deep")}
        className="bottom-[8%] h-[42vh] opacity-40"
        duration="52s"
        fill="var(--wave-deep)"
        variant="deep"
      />

      {/* 3 — mid wave band, counter-drifting */}
      <WaveBand
        layerRef={setRef("mid")}
        className="bottom-[2%] h-[38vh] opacity-55"
        duration="38s"
        fill="var(--wave-mid)"
        variant="mid"
        reverse
      />

      {/* 4 — pearl molecule clusters suspended between the bands */}
      <div ref={setRef("pearls")} className="parallax-layer hidden md:block">
        <PearlCluster className="top-[9%] left-[6%] w-40" />
        <PearlCluster className="top-[24%] right-[9%] w-56" />
        <PearlCluster className="top-[62%] left-[3%] w-28 opacity-70" />
        <PearlCluster className="top-[78%] right-[6%] w-44 opacity-80" />
        <HexOutline className="top-[14%] right-[26%] w-52 opacity-40" />
        <HexOutline className="top-[68%] left-[24%] w-40 opacity-30" />
      </div>

      {/* 5 — near wave band */}
      <WaveBand
        layerRef={setRef("near")}
        className="-bottom-[6%] h-[30vh] opacity-70"
        duration="26s"
        fill="var(--wave-near)"
        variant="near"
      />

      {/* 6 — legibility wash */}
      <div className="brand-veil absolute inset-0" />
    </div>
  );
}

/* -------------------------------------------------------------------------- */

const WAVE_PATHS = {
  // Each path starts and ends at the same height with a matching tangent, so
  // two copies laid side by side tile without a visible seam.
  deep: "M0,150 C240,60 480,60 720,150 C960,240 1200,240 1440,150 L1440,320 L0,320 Z",
  mid: "M0,170 C180,240 420,240 720,160 C1020,80 1260,80 1440,170 L1440,320 L0,320 Z",
  near: "M0,180 C300,110 540,250 720,180 C900,110 1140,250 1440,180 L1440,320 L0,320 Z",
} as const;

function WaveBand({
  layerRef,
  className,
  duration,
  fill,
  variant,
  reverse = false,
}: {
  layerRef: (node: HTMLDivElement | null) => void;
  className: string;
  duration: string;
  fill: string;
  variant: keyof typeof WAVE_PATHS;
  reverse?: boolean;
}) {
  const style = { "--drift-duration": duration } as CSSProperties;

  return (
    <div ref={layerRef} className={`absolute inset-x-0 ${className}`}>
      <div
        className={`wave-drift ${reverse ? "wave-drift--reverse" : ""} flex h-full w-[200%]`}
        style={style}
      >
        {/* Two copies: the drift animation travels exactly one copy's width. */}
        {[0, 1].map((copy) => (
          <svg
            key={copy}
            className="h-full w-1/2 shrink-0"
            viewBox="0 0 1440 320"
            preserveAspectRatio="none"
            focusable="false"
          >
            <path d={WAVE_PATHS[variant]} fill={fill} />
          </svg>
        ))}
      </div>
    </div>
  );
}

/** Pearl sphere cluster with rose-gold bonds, echoing the brand artwork. */
function PearlCluster({ className }: { className: string }) {
  // useId keeps the gradient reference unique and stable across SSR/hydration.
  const gradientId = `pearl${useId().replace(/:/g, "")}`;
  return (
    <div className={`absolute ${className}`}>
      <svg viewBox="0 0 120 120" className="h-auto w-full" focusable="false">
        <defs>
          <radialGradient id={gradientId} cx="35%" cy="30%" r="70%">
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="45%" stopColor="#F6E4D6" />
            <stop offset="100%" stopColor="#DDB79A" />
          </radialGradient>
        </defs>
        <g stroke="#D2A176" strokeWidth="2.5" opacity="0.75">
          <line x1="60" y1="58" x2="24" y2="30" />
          <line x1="60" y1="58" x2="98" y2="38" />
          <line x1="60" y1="58" x2="46" y2="100" />
        </g>
        <circle cx="60" cy="58" r="19" fill={`url(#${gradientId})`} />
        <circle cx="24" cy="30" r="11" fill={`url(#${gradientId})`} />
        <circle cx="98" cy="38" r="9" fill={`url(#${gradientId})`} />
        <circle cx="46" cy="100" r="13" fill={`url(#${gradientId})`} />
      </svg>
    </div>
  );
}

/** Hairline hexagon, echoing the frame in the brand mark. */
function HexOutline({ className }: { className: string }) {
  return (
    <div className={`absolute ${className}`}>
      <svg viewBox="0 0 100 100" className="h-auto w-full" focusable="false">
        <polygon
          points="50,6 88,28 88,72 50,94 12,72 12,28"
          fill="none"
          stroke="#D2A176"
          strokeWidth="1.1"
        />
        <polygon
          points="50,20 76,35 76,65 50,80 24,65 24,35"
          fill="none"
          stroke="#D2A176"
          strokeWidth="0.8"
          strokeDasharray="4 5"
        />
      </svg>
    </div>
  );
}
