import { useCallback, useEffect, useRef, useState } from 'react';
import type { Graphics as PixiGraphics } from 'pixi.js';

interface CoinAnimationProps {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  onComplete: () => void;
}

interface Coin {
  delay: number;
  offsetX: number;
  offsetY: number;
}

export function CoinAnimation({ startX, startY, endX, endY, onComplete }: CoinAnimationProps) {
  const [progress, setProgress] = useState(0);
  const startTimeRef = useRef(Date.now());
  const completedRef = useRef(false);

  const coins = useRef<Coin[]>(
    Array.from({ length: 7 }, (_, i) => ({
      delay: i * 60,
      offsetX: (Math.random() - 0.5) * 60,
      offsetY: (Math.random() - 0.5) * 40,
    }))
  );

  useEffect(() => {
    const duration = 1200;
    let raf: number;

    const animate = () => {
      const elapsed = Date.now() - startTimeRef.current;
      const p = Math.min(1, elapsed / duration);
      setProgress(p);

      if (p >= 1 && !completedRef.current) {
        completedRef.current = true;
        onComplete();
        return;
      }
      raf = requestAnimationFrame(animate);
    };

    raf = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(raf);
  }, [onComplete]);

  const draw = useCallback(
    (g: PixiGraphics) => {
      g.clear();

      for (const coin of coins.current) {
        const coinProgress = Math.max(0, Math.min(1, (progress * 1200 - coin.delay) / 900));
        if (coinProgress <= 0) continue;

        // Bezier-like path: start -> control (with offset) -> end
        const t = coinProgress;
        const ct = 1 - t;
        const ctrlX = (startX + endX) / 2 + coin.offsetX;
        const ctrlY = (startY + endY) / 2 + coin.offsetY - 50;

        const x = ct * ct * startX + 2 * ct * t * ctrlX + t * t * endX;
        const y = ct * ct * startY + 2 * ct * t * ctrlY + t * t * endY;
        const alpha = t < 0.8 ? 1 : 1 - (t - 0.8) / 0.2;

        g.circle(x, y, 5).fill({ color: 0xffd54f, alpha });
        g.circle(x, y, 3).fill({ color: 0xffb300, alpha });
      }
    },
    [progress, startX, startY, endX, endY]
  );

  return <pixiGraphics draw={draw} />;
}
