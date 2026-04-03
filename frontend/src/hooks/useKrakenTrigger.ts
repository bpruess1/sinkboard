import { useEffect, useRef, useState } from 'react';
import type { Task } from '@sink-board/shared';
import { calculateCurrentDepth, TIER_SINK_RATE_PER_MS, KRAKEN_DEPTH_THRESHOLD } from '@sink-board/shared';
import { useKrakenTook } from './useTasks';

export function useKrakenTrigger(
  tasks: Task[],
  isVisible: boolean
): { krakenTarget: string | null } {
  const [krakenTarget, setKrakenTarget] = useState<string | null>(null);
  const lastTriggeredRef = useRef<Map<string, number>>(new Map());
  const krakenMutation = useKrakenTook();

  useEffect(() => {
    if (!isVisible) return;

    const activeTasks = tasks.filter((t) => t.status === 'active');
    const now = Date.now();

    for (const task of activeTasks) {
      const depth = calculateCurrentDepth(
        task.currentDepthPercent,
        task.lastRaisedAt,
        TIER_SINK_RATE_PER_MS[task.sizeTier]
      );

      if (depth >= KRAKEN_DEPTH_THRESHOLD) {
        const lastTriggered = lastTriggeredRef.current.get(task.taskId) ?? 0;
        if (now - lastTriggered < 10_000) continue;

        lastTriggeredRef.current.set(task.taskId, now);
        setKrakenTarget(task.taskId);
        krakenMutation.mutate(task.taskId, {
          onSettled: () => {
            // Clear kraken target after a delay for animation
            setTimeout(() => setKrakenTarget(null), 3000);
          },
        });
        break; // Only attack one at a time
      }
    }
  }, [tasks, isVisible, krakenMutation]);

  return { krakenTarget };
}
