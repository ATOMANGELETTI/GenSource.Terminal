import { useEffect, useRef } from "react";

import type { ParticleEffect } from "../../types";

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

type TerminalParticleFieldProps = {
  mode: ParticleEffect;
  className?: string;
  /** When false, the animation loop freezes (e2e / reduced motion handoff). */
  active?: boolean;
};

const DUST_COUNT = 56;
const ORB_COUNT = 14;
const LINK_DISTANCE = 110;
const MAX_LINKS = 48;
/** Theme semantic tokens that change with `data-theme` (not fixed --nordN). */
const COLOR_VARS = ["--accent", "--info", "--text-muted"] as const;
const COLOR_FALLBACKS = ["#88c0d0", "#b48ead", "#d8dee9"] as const;

function readCssColor(varName: string, fallback: string): string {
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

function lightBoostForMode(effect: ParticleEffect): number {
  return effect === "orbs" ? 1.25 : 1.35;
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

function dustProfile(layer: Layer, light: boolean) {
  const alphaBoost = light ? lightBoostForMode("dust") : 1;
  switch (layer) {
    case "far":
      return {
        radius: 0.55 + Math.random() * 0.8,
        speed: 0.1 + Math.random() * 0.18,
        driftX: 4 + Math.random() * 5,
        driftY: 3 + Math.random() * 4,
        baseAlpha: (0.14 + Math.random() * 0.1) * alphaBoost,
        aspectX: 1,
        aspectY: 1,
      };
    case "near":
      return {
        radius: 1.2 + Math.random() * 1.1,
        speed: 0.22 + Math.random() * 0.28,
        driftX: 10 + Math.random() * 8,
        driftY: 8 + Math.random() * 7,
        baseAlpha: (0.26 + Math.random() * 0.12) * alphaBoost,
        aspectX: 1.08 + Math.random() * 0.25,
        aspectY: 0.72 + Math.random() * 0.14,
      };
    default:
      return {
        radius: 0.8 + Math.random() * 0.95,
        speed: 0.15 + Math.random() * 0.22,
        driftX: 7 + Math.random() * 6,
        driftY: 6 + Math.random() * 5,
        baseAlpha: (0.2 + Math.random() * 0.1) * alphaBoost,
        aspectX: 1.04 + Math.random() * 0.2,
        aspectY: 0.76 + Math.random() * 0.12,
      };
  }
}

function orbProfile(light: boolean) {
  const alphaBoost = light ? lightBoostForMode("orbs") : 1;
  return {
    radius: 18 + Math.random() * 28,
    speed: 0.05 + Math.random() * 0.08,
    driftX: 14 + Math.random() * 18,
    driftY: 12 + Math.random() * 16,
    baseAlpha: (0.08 + Math.random() * 0.07) * alphaBoost,
    aspectX: 1,
    aspectY: 1,
    layer: "mid" as Layer,
  };
}

/**
 * Theme-aware particle canvas behind terminal panes. Modes: dust,
 * constellation (dust + proximity links), orbs. No pointer interaction.
 */
export default function TerminalParticleField({
  mode,
  className,
  active = true,
}: TerminalParticleFieldProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const activeRef = useRef(active);
  const modeRef = useRef(mode);
  const applyModeRef = useRef<((next: ParticleEffect) => void) | null>(null);
  activeRef.current = active;
  modeRef.current = mode;

  useEffect(() => {
    applyModeRef.current?.(mode);
  }, [mode]);

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
    let currentMode: ParticleEffect = modeRef.current;

    const particleCount = (effect: ParticleEffect) =>
      effect === "orbs" ? ORB_COUNT : DUST_COUNT;

    const spawnParticles = (effect: ParticleEffect = currentMode) => {
      light = isLightTheme();
      currentMode = effect;
      const count = particleCount(effect);
      particles = Array.from({ length: count }, () => {
        const x = Math.random() * width;
        const y = Math.random() * height;
        const phase = Math.random() * Math.PI * 2;
        if (effect === "orbs") {
          const profile = orbProfile(light);
          return {
            x,
            y,
            homeX: x,
            homeY: y,
            vx: 0,
            vy: 0,
            phase,
            colorIndex: Math.floor(Math.random() * colors.length),
            ...profile,
          };
        }
        const layer = pickLayer(Math.random());
        const profile = dustProfile(layer, light);
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

    const ensureMode = () => {
      const next = modeRef.current;
      if (next !== currentMode) {
        spawnParticles(next);
        if (reduced) {
          drawStatic();
        }
      }
    };

    const refreshTheme = () => {
      colors = readThemeColors();
      const nextLight = isLightTheme();
      if (nextLight !== light) {
        const boost = lightBoostForMode(currentMode);
        const prevBoost = light ? boost : 1;
        const nextBoost = nextLight ? boost : 1;
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
      spawnParticles(currentMode);
      if (reduced) {
        drawStatic();
      }
    };

    const drawDustParticle = (p: Particle, alpha: number) => {
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

    const drawOrb = (p: Particle, alpha: number) => {
      const color = colors[p.colorIndex] ?? colors[0];
      const gradient = ctx.createRadialGradient(
        p.x,
        p.y,
        0,
        p.x,
        p.y,
        p.radius,
      );
      gradient.addColorStop(0, color);
      gradient.addColorStop(1, "rgba(0,0,0,0)");
      ctx.globalAlpha = alpha;
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fill();
    };

    const drawLinks = () => {
      let drawn = 0;
      const linkAlpha = light ? 0.14 : 0.1;
      for (let i = 0; i < particles.length && drawn < MAX_LINKS; i++) {
        const a = particles[i];
        if (!a) continue;
        for (let j = i + 1; j < particles.length && drawn < MAX_LINKS; j++) {
          const b = particles[j];
          if (!b) continue;
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const dist = Math.hypot(dx, dy);
          if (dist > LINK_DISTANCE || dist < 1) continue;
          const t = 1 - dist / LINK_DISTANCE;
          ctx.beginPath();
          ctx.strokeStyle = colors[a.colorIndex] ?? colors[0];
          ctx.globalAlpha = linkAlpha * t;
          ctx.lineWidth = 0.75;
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
          drawn += 1;
        }
      }
    };

    const drawStatic = () => {
      ctx.clearRect(0, 0, width, height);
      const effect = currentMode;
      if (effect === "constellation") {
        for (const p of particles) {
          p.x = p.homeX;
          p.y = p.homeY;
        }
        drawLinks();
      }
      for (const p of particles) {
        const prevX = p.x;
        const prevY = p.y;
        p.x = p.homeX;
        p.y = p.homeY;
        if (effect === "orbs") {
          drawOrb(p, p.baseAlpha * 0.9);
        } else {
          drawDustParticle(p, p.baseAlpha * 0.9);
        }
        p.x = prevX;
        p.y = prevY;
      }
      ctx.globalAlpha = 1;
    };

    const startLoop = () => {
      cancelAnimationFrame(frameId);
      if (!mounted || reduced || document.hidden || !activeRef.current) {
        return;
      }
      frameId = requestAnimationFrame(tick);
    };

    const tick = (time: number) => {
      if (!mounted) {
        return;
      }

      ensureMode();

      if (reduced) {
        drawStatic();
        return;
      }

      if (document.hidden || !activeRef.current) {
        return;
      }

      const t = time * 0.001;
      const effect = currentMode;
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
      }

      if (effect === "constellation") {
        drawLinks();
      }

      for (const p of particles) {
        const breath =
          0.85 + 0.15 * (0.5 + 0.5 * Math.sin(t * p.speed * 0.9 + p.phase));
        if (effect === "orbs") {
          drawOrb(p, p.baseAlpha * breath);
        } else {
          drawDustParticle(p, p.baseAlpha * breath);
        }
      }

      ctx.globalAlpha = 1;
      frameId = requestAnimationFrame(tick);
    };

    const onMotionChange = (event: MediaQueryListEvent) => {
      reduced = event.matches;
      if (reduced) {
        cancelAnimationFrame(frameId);
        drawStatic();
      } else {
        startLoop();
      }
    };

    const onVisibility = () => {
      if (document.hidden) {
        cancelAnimationFrame(frameId);
        return;
      }
      if (reduced) {
        drawStatic();
      } else {
        startLoop();
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
    document.addEventListener("visibilitychange", onVisibility);

    applyModeRef.current = ensureMode;

    const parent = canvas.parentElement;
    const resizeObserver =
      typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => resize()) : null;
    if (parent && resizeObserver) {
      resizeObserver.observe(parent);
    }

    resize();
    window.addEventListener("resize", resize);

    if (reduced) {
      drawStatic();
    } else {
      startLoop();
    }

    return () => {
      mounted = false;
      applyModeRef.current = null;
      cancelAnimationFrame(frameId);
      window.removeEventListener("resize", resize);
      motionQuery.removeEventListener("change", onMotionChange);
      document.removeEventListener("visibilitychange", onVisibility);
      resizeObserver?.disconnect();
      themeObserver.disconnect();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      aria-hidden="true"
      data-testid="terminal-particle-field"
      data-mode={mode}
    />
  );
}
