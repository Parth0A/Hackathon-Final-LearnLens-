import { useEffect, useRef } from "react";

const GLYPHS = ".:-+*=#%@Learn Lens";
const ACCENT = "#5f9cff";

export default function AsciiLearnLensLogo({ className = "" }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let frame = 0;
    let flickerTimer = 0;
    let resizeObserver: ResizeObserver | null = null;
    let cancelled = false;

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const isCardRoute = new URLSearchParams(window.location.search).has("card");

    type Cell = {
      homeX: number;
      homeY: number;
      x: number;
      y: number;
      vx: number;
      vy: number;
      lit: boolean;
      glyph: string;
      brightness: number;
    };

    let cells: Cell[] = [];
    let cols = 0;
    let rows = 0;
    let dpr = 1;
    let width = 0;
    let height = 0;
    let pointer = { x: 0, y: 0, active: false };
    let virtualT = 0;
    let lastTime = performance.now();

    const rebuild = () => {
      if (cancelled) return;
      const rect = canvas.getBoundingClientRect();
      width = Math.max(1, rect.width);
      height = Math.max(1, rect.height);
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const mobile = width < 640;
      const size = mobile ? 3 : 8;
      const gap = mobile ? 1 : 2;
      const step = size + gap;
      cols = Math.ceil(width / step);
      rows = Math.ceil(height / step);

      const sample = document.createElement("canvas");
      const sampleCtx = sample.getContext("2d", { willReadFrequently: true });
      if (!sampleCtx) return;

      const bannerW = Math.max(160, Math.floor(width * 0.82));
      const bannerH = Math.max(60, Math.floor(bannerW * 0.24));
      sample.width = bannerW;
      sample.height = bannerH;
      sampleCtx.fillStyle = "#000";
      sampleCtx.fillRect(0, 0, bannerW, bannerH);
      sampleCtx.fillStyle = "#fff";
      sampleCtx.textAlign = "center";
      sampleCtx.textBaseline = "middle";

      let fontSize = Math.min(bannerH * 0.72, bannerW / 7.4);
      do {
        sampleCtx.font = `900 ${Math.floor(fontSize)}px Arial Black, Arial, sans-serif`;
        if (sampleCtx.measureText("LearnLens").width <= bannerW * 0.94) break;
        fontSize -= 2;
      } while (fontSize > 10);

      sampleCtx.font = `900 ${Math.max(10, Math.floor(fontSize))}px Arial Black, Arial, sans-serif`;
      sampleCtx.fillText("LearnLens", bannerW / 2, bannerH / 2);

      const pixels = sampleCtx.getImageData(0, 0, bannerW, bannerH).data;
      const next: Cell[] = [];

      for (let row = 0; row < rows; row += 1) {
        for (let col = 0; col < cols; col += 1) {
          const x = col * step + size / 2;
          const y = row * step + size / 2;
          const sx = Math.min(bannerW - 1, Math.max(0, Math.floor(((x - width / 2) + bannerW / 2) * bannerW / width)));
          const sy = Math.min(bannerH - 1, Math.max(0, Math.floor(((y - height / 2) + bannerH / 2) * bannerH / height)));
          const idx = (sy * bannerW + sx) * 4;
          const luma = (0.2126 * pixels[idx] + 0.7152 * pixels[idx + 1] + 0.0722 * pixels[idx + 2]) / 255;
          const lit = luma > 0.5;
          const brightness = lit ? Math.max(0.55, luma) : 0;
          next.push({ homeX: x, homeY: y, x, y, vx: 0, vy: 0, lit, glyph: GLYPHS[Math.floor(brightness * (GLYPHS.length - 1))], brightness });
        }
      }
      cells = next;
      pointer = { x: width / 2, y: height / 2, active: isCardRoute };
      draw();
    };

    const draw = () => {
      ctx.clearRect(0, 0, width, height);
      const gradient = ctx.createRadialGradient(width / 2, height / 2, 0, width / 2, height / 2, Math.max(width, height) * 0.7);
      gradient.addColorStop(0, "#0c0d11");
      gradient.addColorStop(1, "#050507");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);

      const mobile = width < 640;
      const size = mobile ? 3 : 8;
      const gap = mobile ? 1 : 2;
      const step = size + gap;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = `${Math.max(7, size + 1)}px ui-monospace, SFMono-Regular, Menlo, monospace`;

      for (const cell of cells) {
        if (!cell.lit) {
          ctx.fillStyle = "#15161b";
          ctx.fillRect(cell.homeX - 0.55, cell.homeY - 0.55, 1.1, 1.1);
          continue;
        }
        const dx = cell.x - cell.homeX;
        const dy = cell.y - cell.homeY;
        const disp = Math.hypot(dx, dy);
        const mix = Math.min(1, disp / (mobile ? 2 : 3));
        const r = Math.round(245 - (245 - 95) * mix);
        const g = Math.round(242 - (242 - 156) * mix);
        const b = Math.round(236 - (236 - 255) * mix);
        ctx.fillStyle = `rgb(${r} ${g} ${b})`;
        ctx.globalAlpha = Math.min(1, 0.58 + cell.brightness * 0.5);
        ctx.fillText(cell.glyph, cell.x, cell.y);
      }
      ctx.globalAlpha = 1;
    };

    const tick = (now: number) => {
      if (cancelled) return;
      const dt = Math.min(2.2, Math.max(0.5, (now - lastTime) / 16.67));
      lastTime = now;

      if (!prefersReducedMotion) {
        if (isCardRoute) {
          virtualT += 0.018 * dt;
          pointer.x = width * (0.5 + 0.34 * Math.sin(virtualT));
          pointer.y = height * (0.5 + 0.16 * Math.sin(1.7 * virtualT));
          pointer.active = true;
        }

        const mobile = width < 640;
        const radius = mobile ? 7 * 1 : 10 * (width / Math.max(640, width));
        const push = mobile ? 24 : 42;

        for (const cell of cells) {
          if (!cell.lit) continue;
          let fx = 0;
          let fy = 0;
          if (pointer.active) {
            const dx = cell.homeX - pointer.x;
            const dy = cell.homeY - pointer.y;
            const dist = Math.hypot(dx, dy);
            if (dist > 0.001 && dist < radius * (mobile ? 3 : 1)) {
              const weight = Math.pow(1 - dist / (radius * (mobile ? 3 : 1)), 2);
              fx += (dx / dist) * weight * push;
              fy += (dy / dist) * weight * push;
              fx += Math.sin(cell.homeY * 0.05 + now * 0.004) * 5.5 * weight;
              fy += Math.cos(cell.homeX * 0.04 + now * 0.003) * 5.5 * weight;
            }
          }
          cell.vx += fx * 0.035 * dt;
          cell.vy += fy * 0.035 * dt;
          cell.vx += -((cell.x - cell.homeX) * 0.025) * dt;
          cell.vy += -((cell.y - cell.homeY) * 0.025) * dt;
          cell.vx *= Math.pow(0.5, dt);
          cell.vy *= Math.pow(0.5, dt);
          cell.x += cell.vx * dt;
          cell.y += cell.vy * dt;
          if (Math.abs(cell.x - cell.homeX) < 0.025 && Math.abs(cell.vx) < 0.025) {
            cell.x = cell.homeX;
            cell.vx = 0;
          }
          if (Math.abs(cell.y - cell.homeY) < 0.025 && Math.abs(cell.vy) < 0.025) {
            cell.y = cell.homeY;
            cell.vy = 0;
          }
        }

        draw();
      }
      frame = requestAnimationFrame(tick);
    };

    const onMove = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      pointer = { x: event.clientX - rect.left, y: event.clientY - rect.top, active: true };
    };
    const onLeave = () => {
      if (!isCardRoute) pointer.active = false;
    };

    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerenter", onMove);
    canvas.addEventListener("pointerleave", onLeave);

    if (!prefersReducedMotion) {
      flickerTimer = window.setInterval(() => {
        for (const cell of cells) {
          if (!cell.lit) continue;
          const brightness = Math.max(0.55, Math.min(1, cell.brightness + (Math.random() - 0.5) * 0.18));
          cell.glyph = GLYPHS[Math.floor(brightness * (GLYPHS.length - 1))];
        }
      }, 50);
    }

    resizeObserver = new ResizeObserver(rebuild);
    resizeObserver.observe(canvas);
    rebuild();

    if (prefersReducedMotion) draw();
    else frame = requestAnimationFrame(tick);

    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      window.clearInterval(flickerTimer);
      resizeObserver?.disconnect();
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerenter", onMove);
      canvas.removeEventListener("pointerleave", onLeave);
    };
  }, []);

  return (
    <div className={`ascii-stage ${className}`}>
      <canvas ref={canvasRef} aria-label="Interactive LearnLens ASCII wordmark" />
      <div className="ascii-chrome ascii-top">
        <span className="ascii-brand">LearnLens<sup>®</sup></span>
        <span>Interactive ASCII</span>
      </div>
      <div className="ascii-chrome ascii-bottom">
        <span>Hover the glyphs — they scatter</span>
        <span>ASCII / 01</span>
      </div>
      <style>{`
        .ascii-stage{position:relative;width:100%;height:clamp(250px,31vw,430px);overflow:hidden;border:1px solid rgba(95,156,255,.35);border-radius:22px;background:#050507;cursor:crosshair;box-shadow:0 24px 80px rgba(0,0,0,.28)}
        .ascii-stage canvas{position:absolute;inset:0;width:100%;height:100%;display:block}
        .ascii-chrome{position:absolute;z-index:2;display:flex;align-items:center;justify-content:space-between;gap:20px;color:#8fb7ff;font:500 11px/1.2 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.08em;pointer-events:none}
        .ascii-top{top:22px;left:28px;right:28px}
        .ascii-bottom{left:28px;right:28px;bottom:22px;color:#7f9fd8}
        .ascii-brand{color:#f7f7f4;font-size:15px;letter-spacing:.02em}
        .ascii-brand sup{color:#5f9cff;font-size:8px;margin-left:2px}
        @media(max-width:640px){.ascii-stage{height:260px;border-radius:16px}.ascii-top{top:16px;left:17px;right:17px}.ascii-bottom{left:17px;right:17px;bottom:16px}.ascii-chrome{font-size:9px}.ascii-brand{font-size:13px}}
        @media(prefers-reduced-motion:reduce){.ascii-stage{cursor:default}}
      `}</style>
    </div>
  );
}
