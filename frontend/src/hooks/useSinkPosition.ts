import { useEffect, useRef, useState } from 'react';
import type { Task } from '@sink-board/shared';
import { calculateCurrentDepth, TIER_SINK_RATE_PER_MS, KRAKEN_DEPTH_THRESHOLD } from '@sink-board/shared';

export function useSinkPosition(task: Task): { depth: number; isAtBottom: boolean } {
  const [depth, setDepth] = useState(() =>
    task.status === 'active'
      ? calculateCurrentDepth(
          task.currentDepthPercent,
          task.lastRaisedAt,
          TIER_SINK_RATE_PER_MS[task.sizeTier]
        )
      : task.currentDepthPercent
  );
  const rafRef = useRef<number>(0);
  const lastUpdateRef = useRef(Date.now());

  useEffect(() => {
    if (task.status !== 'active') {
      setDepth(task.currentDepthPercent);
      return;
    }

    const tick = () => {
      const now = Date.now();
      // Only recalculate every ~1 second
      if (now - lastUpdateRef.current >= 1000) {
        lastUpdateRef.current = now;
        const d = calculateCurrentDepth(
          task.currentDepthPercent,
          task.lastRaisedAt,
          TIER_SINK_RATE_PER_MS[task.sizeTier]
        );
        setDepth(d);
      }
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [task.currentDepthPercent, task.lastRaisedAt, task.sizeTier, task.status]);

  return {
    depth,
    isAtBottom: depth >= KRAKEN_DEPTH_THRESHOLD,
  };
}
