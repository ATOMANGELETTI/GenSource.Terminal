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
  magnetScale: number;
  aspectX: number;
  aspectY: number;
};

type ParticleFieldProps = {
  className?: string;
  /** When false, the animation loop stops (splash dismissing). */
  active?: boolean;
};

const PARTICLE_COUNT = 120;
const LINK_DISTANCE = 72;
const LINK_DISTANCE_SQ = LINK_DISTANCE * LINK_DISTANCE;
/** Hard cap so O(n²) neighbor checks stay smooth on a ~520×340 splash. */
const MAX_LINKS_PER_FRAME = 100;
const COLOR_VARS = ["--nord7", "--nord8", "--nord9", "--nord10"] as const;
const COLOR_FALLBACKS = ["#8fbcbb", "#88c0d0", "#81a1c1", "#5e81ac"] as const;

function readCssColor(varName: string, fallback: string): string {
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(varName)
    .trim();
  return value || fallback;
}

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function pickLayer(roll: number): Layer {
  if (roll < 0.52) {
    return "far";
  }
  if (roll < 0.88) {
    return "mid";
  }
  return "near";
}

function layerProfile(layer: Layer) {
  switch (layer) {
    case "far":
      return {
        radius: 0.55 + Math.random() * 0.85,
        speed: 0.18 + Math.random() * 0.28,
        driftX: 6 + Math.random() * 6,
        driftY: 5 + Math.random() * 5,
        baseAlpha: 0.14 + Math.random() * 0.1,
        magnetScale: 0.35,
        aspectX: 1,
        aspectY: 1,
      };
    case "near":
      return {
        radius: 1.6 + Math.random() * 1.5,
        speed: 0.45 + Math.random() * 0.55,
        driftX: 16 + Math.random() * 12,
        driftY: 14 + Math.random() * 10,
        baseAlpha: 0.32 + Math.random() * 0.14,
        magnetScale: 1.15,
        aspectX: 1.15 + Math.random() * 0.35,
        aspectY: 0.65 + Math.random() * 0.2,
      };
    default:
      return {
        radius: 0.95 + Math.random() * 1.25,
        speed: 0.3 + Math.random() * 0.45,
        driftX: 10 + Math.random() * 8,
        driftY: 9 + Math.random() * 7,
        baseAlpha: 0.22 + Math.random() * 0.12,
        magnetScale: 0.75,
        aspectX: 1.05 + Math.random() * 0.3,
        aspectY: 0.72 + Math.random() * 0.15,
      };
  }
}

/**
 * Lightweight Antigravity-inspired 2D particle field: layered Nord frost dots
 * with sine drift, opacity breathing, proximity links, and a gentle cursor
 * magnet. Canvas 2D only — no WebGL / Three.js.
 */
export default function ParticleField({
  className,
  active = true,
}: ParticleFieldProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pointerRef = useRef({ x: -9999, y: -9999, active: false });
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
    let reduced = prefersReducedMotion();
    let mounted = true;

    const colors = COLOR_VARS.map((name, index) =>
      readCssColor(name, COLOR_FALLBACKS[index] ?? COLOR_FALLBACKS[0]),
    );

    const spawnParticles = () => {
      particles = Array.from({ length: PARTICLE_COUNT }, () => {
        const x = Math.random() * width;
        const y = Math.random() * height;
        const phase = Math.random() * Math.PI * 2;
        const layer = pickLayer(Math.random());
        const profile = layerProfile(layer);
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

    const resize = () => {
      const parent = canvas.parentElement;
      const nextWidth = parent?.clientWidth ?? window.innerWidth;
      const nextHeight = parent?.clientHeight ?? window.innerHeight;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = nextWidth;
      height = nextHeight;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      spawnParticles();
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
        drawParticle(p, p.baseAlpha * 0.95);
        p.x = prevX;
        p.y = prevY;
      }
      ctx.globalAlpha = 1;
    };

    const drawLinks = () => {
      let links = 0;
      // Stride neighbor checks to keep the pair budget under control.
      const stride = 2;
      for (let i = 0; i < particles.length && links < MAX_LINKS_PER_FRAME; i += stride) {
        const a = particles[i];
        if (!a || a.layer === "far") {
          continue;
        }
        for (
          let j = i + 1;
          j < particles.length && links < MAX_LINKS_PER_FRAME;
          j += 1
        ) {
          const b = particles[j];
          if (!b || b.layer === "far") {
            continue;
          }
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const distSq = dx * dx + dy * dy;
          if (distSq > LINK_DISTANCE_SQ || distSq < 0.01) {
            continue;
          }
          const dist = Math.sqrt(distSq);
          const fade = 1 - dist / LINK_DISTANCE;
          ctx.beginPath();
          ctx.strokeStyle = colors[a.colorIndex] ?? colors[0];
          ctx.globalAlpha = 0.035 + fade * 0.05;
          ctx.lineWidth = 1;
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
          links += 1;
        }
      }
    };

    const tick = (time: number) => {
      if (!mounted) {
        return;
      }

      if (reduced) {
        drawStatic();
        return;
      }

      // Freeze the last frame while splash exits — do not clear/respawn.
      if (!activeRef.current) {
        return;
      }

      const t = time * 0.001;
      const pointer = pointerRef.current;

      ctx.clearRect(0, 0, width, height);

      for (const p of particles) {
        const driftX = Math.sin(t * p.speed + p.phase) * p.driftX;
        const driftY = Math.cos(t * p.speed * 0.85 + p.phase) * p.driftY;
        let targetX = p.homeX + driftX;
        let targetY = p.homeY + driftY;

        if (pointer.active) {
          const dx = pointer.x - p.x;
          const dy = pointer.y - p.y;
          const dist = Math.hypot(dx, dy) || 1;
          const magnetRadius = 130 + p.magnetScale * 30;
          if (dist < magnetRadius) {
            const pull =
              (1 - dist / magnetRadius) * 26 * p.magnetScale;
            targetX += (dx / dist) * pull;
            targetY += (dy / dist) * pull;
          }
        }

        p.vx += (targetX - p.x) * 0.04;
        p.vy += (targetY - p.y) * 0.04;
        p.vx *= 0.86;
        p.vy *= 0.86;
        p.x += p.vx;
        p.y += p.vy;

        const breath =
          0.82 + 0.18 * (0.5 + 0.5 * Math.sin(t * p.speed * 1.2 + p.phase));
        drawParticle(p, p.baseAlpha * breath);
      }

      drawLinks();
      ctx.globalAlpha = 1;
      frameId = requestAnimationFrame(tick);
    };

    const onPointerMove = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      pointerRef.current = {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
        active: true,
      };
    };

    const onPointerLeave = () => {
      pointerRef.current = { x: -9999, y: -9999, active: false };
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

    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    motionQuery.addEventListener("change", onMotionChange);

    resize();
    window.addEventListener("resize", resize);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerleave", onPointerLeave);

    if (reduced) {
      drawStatic();
    } else if (activeRef.current) {
      frameId = requestAnimationFrame(tick);
    }

    return () => {
      mounted = false;
      cancelAnimationFrame(frameId);
      window.removeEventListener("resize", resize);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerleave", onPointerLeave);
      motionQuery.removeEventListener("change", onMotionChange);
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
