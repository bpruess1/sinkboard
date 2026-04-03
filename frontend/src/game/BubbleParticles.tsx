import { useCallback, useRef, useEffect, useState } from 'react';
import type { Graphics as PixiGraphics } from 'pixi.js';

interface BubbleParticlesProps {
  width: number;
  height: number;
}

interface Bubble {
  x: number;
  y: number;
  radius: number;
  speed: number;
  alpha: number;
}

function createBubble(width: number, height: number): Bubble {
  return {
    x: Math.random() * width,
    y: height + Math.random() * 50,
    radius: 2 + Math.random() * 4,
    speed: 0.2 + Math.random() * 0.5,
    alpha: 0.1 + Math.random() * 0.2,
  };
}

export function BubbleParticles({ width, height }: BubbleParticlesProps) {
  const bubblesRef = useRef<Bubble[]>([]);
  const [, setTick] = useState(0);

  // Initialize bubbles
  useEffect(() => {
    bubblesRef.current = Array.from({ length: 18 }, () => {
      const b = createBubble(width, height);
      b.y = Math.random() * height; // Spread initially
      return b;
    });
  }, [width, height]);

  // Animate
  useEffect(() => {
    let raf: number;
    const animate = () => {
      for (const b of bubblesRef.current) {
        b.y -= b.speed;
        b.x += Math.sin(b.y * 0.01) * 0.3;
        if (b.y < -10) {
          b.y = height + 10;
          b.x = Math.random() * width;
        }
      }
      setTick((t) => t + 1);
      raf = requestAnimationFrame(animate);
    };
    raf = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(raf);
  }, [width, height]);

  const draw = useCallback(
    (g: PixiGraphics) => {
      g.clear();
      for (const b of bubblesRef.current) {
        g.circle(b.x, b.y, b.radius).fill({ color: 0xffffff, alpha: b.alpha });
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [bubblesRef.current]
  );

  return <pixiGraphics draw={draw} />;
}
