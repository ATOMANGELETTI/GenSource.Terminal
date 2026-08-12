import { useEffect, useRef } from "react";

type Layer = "far" | "mid" | "near";

type Particle = {
  x: number;
  y: number;
  homeX: number;
  homeY: number;
  vx: number;
  vy: number;
  radius: number;
  phase: number;
  speed: number;
  colorIndex: number;
  layer: Layer;
  driftX: number;
  driftY: number;
  baseAlpha: number;
  aspectX: number;
  aspectY: number;
};

type AmbientFieldProps = {
  className?: string;
  /** When false, the animation loop freezes (e2e / reduced motion handoff). */
  active?: boolean;
};

const PARTICLE_COUNT = 60;
/** Theme semantic tokens that change with `data-theme` (not fixed --nordN). */
const COLOR_VARS = ["--accent", "--info", "--text-muted"] as const;
const COLOR_FALLBACKS = ["#88c0d0", "#b48ead", "#d8dee9"] as const;

function readCssColor(varName: string, fallback: string): string {
  // Semantic tokens are `var(--nordN)` references — canvas fillStyle needs a
  // resolved rgb()/hex, so probe via a temporary element.
  const probe = document.createElement("span");
  probe.style.cssText =
    "position:absolute;left:-9999px;top:0;width:1px;height:1px;pointer-events:none;color:var(" +
    varName +
    ")";
  document.documentElement.appendChild(probe);
  const resolved = getComputedStyle(probe).color.trim();
  probe.remove();
  if (
    !resolved ||
    resolved === "rgba(0, 0, 0, 0)" ||
    resolved === "transparent"
  ) {
    return fallback;
  }
  return resolved;
}

function readThemeColors(): string[] {
  return COLOR_VARS.map((name, index) =>
    readCssColor(name, COLOR_FALLBACKS[index] ?? COLOR_FALLBACKS[0]),
  );
}

function isLightTheme(): boolean {
  const root = document.documentElement;
  const theme = root.dataset.theme ?? "";
  if (theme.includes("light") || theme.includes("snow-storm")) {
    return true;
  }
  return getComputedStyle(root).colorScheme === "light";
}

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function pickLayer(roll: number): Layer {
  if (roll < 0.55) {
    return "far";
  }
  if (roll < 0.9) {
    return "mid";
  }
  return "near";
}

function layerProfile(layer: Layer, light: boolean) {
  const alphaBoost = light ? 1.4 : 1;
  switch (layer) {
    case "far":
      return {
        radius: 0.6 + Math.random() * 0.9,
        speed: 0.12 + Math.random() * 0.2,
        driftX: 5 + Math.random() * 6,
        driftY: 4 + Math.random() * 5,
        baseAlpha: (0.18 + Math.random() * 0.12) * alphaBoost,
        aspectX: 1,
        aspectY: 1,
      };
    case "near":
      return {
        radius: 1.4 + Math.random() * 1.3,
        speed: 0.28 + Math.random() * 0.35,
        driftX: 12 + Math.random() * 9,
        driftY: 10 + Math.random() * 8,
        baseAlpha: (0.34 + Math.random() * 0.14) * alphaBoost,
        aspectX: 1.1 + Math.random() * 0.3,
        aspectY: 0.7 + Math.random() * 0.15,
      };
    default:
      return {
        radius: 0.9 + Math.random() * 1.1,
        speed: 0.18 + Math.random() * 0.28,
        driftX: 8 + Math.random() * 7,
        driftY: 7 + Math.random() * 6,
        baseAlpha: (0.24 + Math.random() * 0.12) * alphaBoost,
        aspectX: 1.05 + Math.random() * 0.25,
        aspectY: 0.75 + Math.random() * 0.12,
      };
  }
}

/**
 * Quiet ambient particle field for the main content area. Uses theme semantic
 * colors (`--accent` / `--info` / `--text-muted`) and refreshes them when
 * `data-theme` changes — no links, no cursor magnet, flat Nord (no glow).
 */
export default function AmbientField({
  className,
  active = true,
}: AmbientFieldProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const activeRef = useRef(active);
  activeRef.current = active;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return;
    }

    let width = 0;
    let height = 0;
    let dpr = 1;
    let frameId = 0;
    let particles: Particle[] = [];
    let colors = readThemeColors();
    let light = isLightTheme();
    let reduced = prefersReducedMotion();
    let mounted = true;

    const spawnParticles = () => {
      light = isLightTheme();
      particles = Array.from({ length: PARTICLE_COUNT }, () => {
        const x = Math.random() * width;
        const y = Math.random() * height;
        const phase = Math.random() * Math.PI * 2;
        const layer = pickLayer(Math.random());
        const profile = layerProfile(layer, light);
        return {
          x,
          y,
          homeX: x,
          homeY: y,
          vx: 0,
          vy: 0,
          phase,
          colorIndex: Math.floor(Math.random() * colors.length),
          layer,
          ...profile,
        };
      });
    };

    const refreshTheme = () => {
      colors = readThemeColors();
      const nextLight = isLightTheme();
      if (nextLight !== light) {
        const prevBoost = light ? 1.4 : 1;
        const nextBoost = nextLight ? 1.4 : 1;
        const scale = nextBoost / prevBoost;
        light = nextLight;
        for (const p of particles) {
          p.baseAlpha *= scale;
        }
      }
      if (reduced) {
        drawStatic();
      }
    };

    const resize = () => {
      const parent = canvas.parentElement;
      const nextWidth = Math.max(1, parent?.clientWidth ?? window.innerWidth);
      const nextHeight = Math.max(1, parent?.clientHeight ?? window.innerHeight);
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = nextWidth;
      height = nextHeight;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      spawnParticles();
      if (reduced) {
        drawStatic();
      }
    };

    const drawParticle = (p: Particle, alpha: number) => {
      ctx.beginPath();
      ctx.fillStyle = colors[p.colorIndex] ?? colors[0];
      ctx.globalAlpha = alpha;
      if (p.layer === "far") {
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      } else {
        ctx.ellipse(
          p.x,
          p.y,
          p.radius * p.aspectX,
          p.radius * p.aspectY,
          p.phase,
          0,
          Math.PI * 2,
        );
      }
      ctx.fill();
    };

    const drawStatic = () => {
      ctx.clearRect(0, 0, width, height);
      for (const p of particles) {
        const prevX = p.x;
        const prevY = p.y;
        p.x = p.homeX;
        p.y = p.homeY;
        drawParticle(p, p.baseAlpha * 0.9);
        p.x = prevX;
        p.y = prevY;
      }
      ctx.globalAlpha = 1;
    };

    const tick = (time: number) => {
      if (!mounted) {
        return;
      }

      if (reduced) {
        drawStatic();
        return;
      }

      if (!activeRef.current) {
        return;
      }

      const t = time * 0.001;
      ctx.clearRect(0, 0, width, height);

      for (const p of particles) {
        const driftX = Math.sin(t * p.speed + p.phase) * p.driftX;
        const driftY = Math.cos(t * p.speed * 0.85 + p.phase) * p.driftY;
        const targetX = p.homeX + driftX;
        const targetY = p.homeY + driftY;

        p.vx += (targetX - p.x) * 0.03;
        p.vy += (targetY - p.y) * 0.03;
        p.vx *= 0.9;
        p.vy *= 0.9;
        p.x += p.vx;
        p.y += p.vy;

        const breath =
          0.85 + 0.15 * (0.5 + 0.5 * Math.sin(t * p.speed * 0.9 + p.phase));
        drawParticle(p, p.baseAlpha * breath);
      }

      ctx.globalAlpha = 1;
      frameId = requestAnimationFrame(tick);
    };

    const onMotionChange = (event: MediaQueryListEvent) => {
      reduced = event.matches;
      if (reduced) {
        cancelAnimationFrame(frameId);
        drawStatic();
      } else if (mounted && activeRef.current) {
        frameId = requestAnimationFrame(tick);
      }
    };

    const themeObserver = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (
          mutation.type === "attributes" &&
          mutation.attributeName === "data-theme"
        ) {
          refreshTheme();
          break;
        }
      }
    });
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });

    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    motionQuery.addEventListener("change", onMotionChange);

    resize();
    window.addEventListener("resize", resize);

    if (reduced) {
      drawStatic();
    } else if (activeRef.current) {
      frameId = requestAnimationFrame(tick);
    }

    return () => {
      mounted = false;
      cancelAnimationFrame(frameId);
      window.removeEventListener("resize", resize);
      motionQuery.removeEventListener("change", onMotionChange);
      themeObserver.disconnect();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      aria-hidden="true"
    />
  );
}
