import { useCallback, useEffect, useRef, useState } from 'react';
import type { Graphics as PixiGraphics } from 'pixi.js';

interface KrakenAnimationProps {
  targetX: number;
  targetY: number;
  sceneHeight: number;
  onComplete: () => void;
}

export function KrakenAnimation({
  targetX,
  targetY,
  sceneHeight,
  onComplete,
}: KrakenAnimationProps) {
  const [progress, setProgress] = useState(0);
  const startTimeRef = useRef(Date.now());
  const completedRef = useRef(false);

  useEffect(() => {
    const duration = 3000;
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

  const drawTentacles = useCallback(
    (g: PixiGraphics) => {
      g.clear();

      const tentacleCount = 4;
      const riseAmount = progress * (sceneHeight - targetY + 60);

      for (let i = 0; i < tentacleCount; i++) {
        const baseX = targetX + (i - 1.5) * 30;
        const baseY = sceneHeight;
        const tipY = baseY - riseAmount;
        const waveOffset = Math.sin(progress * Math.PI * 2 + i * 1.5) * 20;

        g.moveTo(baseX - 5, baseY);
        g.bezierCurveTo(
          baseX + waveOffset, baseY - riseAmount * 0.3,
          baseX - waveOffset, baseY - riseAmount * 0.7,
          targetX + waveOffset * 0.5, tipY
        );
        g.bezierCurveTo(
          targetX + waveOffset * 0.5 + 8, tipY,
          baseX - waveOffset + 8, baseY - riseAmount * 0.7,
          baseX + waveOffset + 8, baseY - riseAmount * 0.3
        );
        g.lineTo(baseX + 5, baseY);
        g.closePath();

        const alpha = 0.6 + progress * 0.3;
        g.fill({ color: 0xb71c1c, alpha });
      }

      // Suckers (small circles on tentacles)
      if (progress > 0.3) {
        for (let i = 0; i < tentacleCount; i++) {
          const baseX = targetX + (i - 1.5) * 30;
          for (let j = 0; j < 3; j++) {
            const t = 0.3 + j * 0.2;
            const sY = sceneHeight - riseAmount * t;
            const waveOffset = Math.sin(progress * Math.PI * 2 + i * 1.5) * 20 * t;
            g.circle(baseX + waveOffset, sY, 2).fill({ color: 0xe57373, alpha: 0.5 });
          }
        }
      }
    },
    [progress, targetX, targetY, sceneHeight]
  );

  return <pixiGraphics draw={drawTentacles} />;
}
