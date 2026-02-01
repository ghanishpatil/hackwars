import { useRef, useEffect, useCallback } from 'react';

const NODE_COUNT = 100;
const CONNECT_DISTANCE = 200;
const GLOW_RADIUS = 220;
const LINE_COLOR = 'rgba(0, 229, 255, 0.28)';
const LINE_COLOR_ORANGE = 'rgba(255, 171, 0, 0.18)';
const NODE_COLOR = 'rgba(0, 229, 255, 0.55)';
const NODE_COLOR_HOT = 'rgba(0, 229, 255, 0.95)';
const CURSOR_GLOW = 'rgba(0, 229, 255, 0.12)';
const CURSOR_GLOW_ORANGE = 'rgba(255, 171, 0, 0.08)';

function useAnimationFrame(callback) {
  const rafRef = useRef();
  const callbackRef = useRef(callback);
  callbackRef.current = callback;
  useEffect(() => {
    const tick = () => {
      callbackRef.current();
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);
}

export function NetworkBackground() {
  const canvasRef = useRef(null);
  const nodesRef = useRef([]);
  const sizeRef = useRef({ w: 1920, h: 1080 });
  const mouseRef = useRef({ x: 0.5, y: 0.5 });

  useEffect(() => {
    const onMove = (e) => {
      mouseRef.current.x = e.clientX / window.innerWidth;
      mouseRef.current.y = e.clientY / window.innerHeight;
    };
    window.addEventListener('mousemove', onMove);
    return () => window.removeEventListener('mousemove', onMove);
  }, []);

  const initNodes = useCallback((w, h) => {
    const nodes = [];
    for (let i = 0; i < NODE_COUNT; i++) {
      nodes.push({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
      });
    }
    return nodes;
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const w = window.innerWidth;
    const h = window.innerHeight;
    const ctx = canvas.getContext('2d');
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    ctx.scale(dpr, dpr);
    nodesRef.current = initNodes(w, h);
  }, [initNodes]);

  useAnimationFrame(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width / (window.devicePixelRatio || 1);
    const h = canvas.height / (window.devicePixelRatio || 1);
    const nodes = nodesRef.current;
    if (!nodes.length) return;

    ctx.clearRect(0, 0, w, h);

    const { x: mxNorm, y: myNorm } = mouseRef.current;
    const mx = mxNorm * w;
    const my = myNorm * h;

    nodes.forEach((node, i) => {
      node.x += node.vx;
      node.y += node.vy;
      if (node.x < 0 || node.x > w) node.vx *= -1;
      if (node.y < 0 || node.y > h) node.vy *= -1;
      node.x = Math.max(0, Math.min(w, node.x));
      node.y = Math.max(0, Math.min(h, node.y));
    });

    nodes.forEach((a, i) => {
      nodes.slice(i + 1).forEach((b) => {
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const dist = Math.hypot(dx, dy);
        if (dist < CONNECT_DISTANCE) {
          const midX = (a.x + b.x) / 2;
          const midY = (a.y + b.y) / 2;
          const distMidToCursor = Math.hypot(midX - mx, midY - my);
          const nearCursor = distMidToCursor < GLOW_RADIUS;
          const alpha = (1 - dist / CONNECT_DISTANCE) * (nearCursor ? 0.55 : 0.32);
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.strokeStyle = nearCursor ? LINE_COLOR.replace('0.28', Math.min(0.6, alpha).toFixed(2)) : LINE_COLOR_ORANGE.replace('0.18', Math.min(0.4, alpha).toFixed(2));
          ctx.lineWidth = nearCursor ? 1.8 : 1.2;
          ctx.stroke();
        }
      });
    });

    const g = ctx.createRadialGradient(mx, my, 0, mx, my, GLOW_RADIUS);
    g.addColorStop(0, CURSOR_GLOW.replace('0.08', '0.2'));
    g.addColorStop(0.4, CURSOR_GLOW);
    g.addColorStop(0.7, CURSOR_GLOW_ORANGE);
    g.addColorStop(1, 'transparent');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(mx, my, GLOW_RADIUS, 0, Math.PI * 2);
    ctx.fill();

    nodes.forEach((node) => {
      const distToCursor = Math.hypot(node.x - mx, node.y - my);
      const inRadius = distToCursor < GLOW_RADIUS;
      const glow = inRadius ? (1 - distToCursor / GLOW_RADIUS) * 0.65 + 0.5 : 0.5;
      const radius = inRadius ? 3 : 2;
      ctx.beginPath();
      ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
      ctx.fillStyle = inRadius ? NODE_COLOR_HOT.replace('0.95', glow.toFixed(2)) : NODE_COLOR.replace('0.55', glow.toFixed(2));
      ctx.fill();
    });
  });

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
    />
  );
}
