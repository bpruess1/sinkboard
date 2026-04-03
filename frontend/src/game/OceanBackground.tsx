import { useCallback } from 'react';
import type { Graphics as PixiGraphics } from 'pixi.js';

interface OceanBackgroundProps {
  width: number;
  height: number;
}

const ZONES = [
  { start: 0, end: 0.15, color: 0x4fc3f7 },
  { start: 0.15, end: 0.35, color: 0x0288d1 },
  { start: 0.35, end: 0.55, color: 0x01579b },
  { start: 0.55, end: 0.75, color: 0x0d2137 },
  { start: 0.75, end: 1.0, color: 0x050a12 },
];

export function OceanBackground({ width, height }: OceanBackgroundProps) {
  const drawBackground = useCallback(
    (g: PixiGraphics) => {
      g.clear();

      // Draw gradient bands
      for (const zone of ZONES) {
        const y = zone.start * height;
        const h = (zone.end - zone.start) * height;
        g.rect(0, y, width, h).fill(zone.color);
      }

      // Light rays near the surface
      for (let i = 0; i < 5; i++) {
        const x = width * 0.1 + i * (width * 0.2);
        g.moveTo(x, 0);
        g.lineTo(x + 40, height * 0.35);
        g.lineTo(x + 20, height * 0.35);
        g.lineTo(x - 20, 0);
        g.closePath();
        g.fill({ color: 0xffffff, alpha: 0.03 });
      }

      // Water surface line (wavy sine curve)
      const surfaceY = height * 0.12;
      g.moveTo(0, surfaceY);
      for (let x = 0; x <= width; x += 4) {
        const y = surfaceY + Math.sin(x * 0.02) * 4 + Math.sin(x * 0.005) * 6;
        g.lineTo(x, y);
      }
      g.lineTo(width, surfaceY + 3);
      g.lineTo(0, surfaceY + 3);
      g.closePath();
      g.fill({ color: 0xffffff, alpha: 0.12 });
    },
    [width, height]
  );

  return <pixiGraphics draw={drawBackground} />;
}
