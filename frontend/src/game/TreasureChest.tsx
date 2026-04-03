import { useCallback, useMemo, useState, useEffect, useRef } from 'react';
import { TextStyle } from 'pixi.js';
import type { Graphics as PixiGraphics } from 'pixi.js';
import type { SizeTier } from '@sink-board/shared';

interface TreasureChestProps {
  taskId: string;
  title: string;
  sizeTier: SizeTier;
  jewelLevel: number;
  depth: number;
  sceneWidth: number;
  sceneHeight: number;
  onClick: () => void;
}

const CHEST_SIZES: Record<SizeTier, { w: number; h: number }> = {
  S: { w: 30, h: 25 },
  M: { w: 40, h: 32 },
  L: { w: 55, h: 42 },
  XL: { w: 70, h: 55 },
};

const JEWEL_COLORS = [0xe53935, 0x43a047, 0x1e88e5];

function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    hash = ((hash << 5) - hash + ch) | 0;
  }
  return Math.abs(hash);
}

export function TreasureChest({
  taskId,
  title,
  sizeTier,
  jewelLevel,
  depth,
  sceneWidth,
  sceneHeight,
  onClick,
}: TreasureChestProps) {
  const [bobOffset, setBobOffset] = useState(0);
  const startTimeRef = useRef(Date.now());

  useEffect(() => {
    const interval = setInterval(() => {
      const elapsed = (Date.now() - startTimeRef.current) / 1000;
      setBobOffset(Math.sin(elapsed * ((2 * Math.PI) / 3)) * 3);
    }, 50);
    return () => clearInterval(interval);
  }, []);

  const hash = useMemo(() => hashCode(taskId), [taskId]);
  const x = useMemo(() => {
    const margin = 80;
    return margin + (hash % (Math.max(1, sceneWidth - margin * 2)));
  }, [hash, sceneWidth]);

  const { w, h } = CHEST_SIZES[sizeTier];

  // Map depth 0-100 to scene Y. Top margin at 15%, bottom margin at 5%.
  const topMargin = sceneHeight * 0.15;
  const bottomMargin = sceneHeight * 0.05;
  const usableHeight = sceneHeight - topMargin - bottomMargin;
  const y = topMargin + (depth / 100) * usableHeight + bobOffset;

  const drawChest = useCallback(
    (g: PixiGraphics) => {
      g.clear();

      const halfW = w / 2;
      const halfH = h / 2;

      // Body
      g.roundRect(-halfW, -halfH, w, h, 4).fill(0x8b4513);

      // Lid line
      g.rect(-halfW, -halfH, w, h * 0.35).fill(0x6d3710);

      // Gold trim for M+
      if (sizeTier !== 'S') {
        g.rect(-halfW + 2, -halfH + h * 0.33, w - 4, 3).fill(0xffd54f);
      }

      // Gold bands for L+
      if (sizeTier === 'L' || sizeTier === 'XL') {
        g.rect(-halfW, -halfH + 2, 3, h - 4).fill(0xffd54f);
        g.rect(halfW - 3, -halfH + 2, 3, h - 4).fill(0xffd54f);
      }

      // Gold fill areas for XL
      if (sizeTier === 'XL') {
        g.rect(-halfW + 5, halfH - 12, w - 10, 6).fill({ color: 0xffd54f, alpha: 0.4 });
      }

      // Lock/clasp
      g.circle(0, -halfH + h * 0.35, 3).fill(0xffd54f);

      // Jewels
      const jCount = Math.min(jewelLevel, 3);
      for (let i = 0; i < jCount; i++) {
        const jx = -8 + i * 8;
        const jy = halfH - 8;
        g.circle(jx, jy, 3).fill(JEWEL_COLORS[i]);
      }
    },
    [w, h, sizeTier, jewelLevel]
  );

  const labelStyle = useMemo(
    () =>
      new TextStyle({
        fontSize: 10,
        fill: 0xe0e0e0,
        fontFamily: 'system-ui',
        wordWrap: true,
        wordWrapWidth: 80,
        align: 'center',
      }),
    []
  );

  const truncatedTitle = title.length > 18 ? title.slice(0, 16) + '...' : title;

  return (
    <pixiContainer x={x} y={y} eventMode="static" cursor="pointer" onTap={onClick} onClick={onClick}>
      <pixiGraphics draw={drawChest} />
      <pixiText text={truncatedTitle} {...{ style: labelStyle }} anchor={0.5} y={h / 2 + 10} />
    </pixiContainer>
  );
}
