import { useEffect, useRef, useState, useCallback } from 'react';
import { logger } from '../utils/logger';

interface PerformanceMetrics {
  fps: number;
  avgFrameTime: number;
  frameDrops: number;
  worstFrameTime: number;
}

const TARGET_FPS = 60;
const FRAME_TIME_THRESHOLD = 1000 / 30; // 30 FPS threshold
const SAMPLE_SIZE = 60; // Track last 60 frames

export function usePerformanceMonitor(enabled = true) {
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    fps: 60,
    avgFrameTime: 16.67,
    frameDrops: 0,
    worstFrameTime: 0,
  });

  const frameTimesRef = useRef<number[]>([]);
  const lastFrameTimeRef = useRef<number>(performance.now());
  const frameDropCountRef = useRef(0);
  const rafIdRef = useRef<number>();
  const updateIntervalRef = useRef<NodeJS.Timeout>();

  const measureFrame = useCallback(() => {
    if (!enabled) return;

    const now = performance.now();
    const frameTime = now - lastFrameTimeRef.current;
    lastFrameTimeRef.current = now;

    // Track frame time
    frameTimesRef.current.push(frameTime);
    if (frameTimesRef.current.length > SAMPLE_SIZE) {
      frameTimesRef.current.shift();
    }

    // Count frame drops (frames taking longer than threshold)
    if (frameTime > FRAME_TIME_THRESHOLD) {
      frameDropCountRef.current++;
    }

    rafIdRef.current = requestAnimationFrame(measureFrame);
  }, [enabled]);

  const updateMetrics = useCallback(() => {
    const frameTimes = frameTimesRef.current;
    if (frameTimes.length === 0) return;

    const avgFrameTime = frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length;
    const fps = Math.round(1000 / avgFrameTime);
    const worstFrameTime = Math.max(...frameTimes);
    const frameDrops = frameDropCountRef.current;

    const newMetrics = {
      fps,
      avgFrameTime: Math.round(avgFrameTime * 100) / 100,
      frameDrops,
      worstFrameTime: Math.round(worstFrameTime * 100) / 100,
    };

    setMetrics(newMetrics);

    // Log warning if performance is degraded
    if (fps < 30) {
      logger.warn('Low FPS detected', { metrics: newMetrics });
    }

    // Reset frame drop counter
    frameDropCountRef.current = 0;
  }, []);

  useEffect(() => {
    if (!enabled) return;

    lastFrameTimeRef.current = performance.now();
    rafIdRef.current = requestAnimationFrame(measureFrame);

    // Update metrics display every second
    updateIntervalRef.current = setInterval(updateMetrics, 1000);

    return () => {
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
      }
      if (updateIntervalRef.current) {
        clearInterval(updateIntervalRef.current);
      }
    };
  }, [enabled, measureFrame, updateMetrics]);

  return metrics;
}

export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  const timeoutRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [value, delay]);

  return debouncedValue;
}

export function useViewportCulling(
  viewportWidth: number,
  viewportHeight: number,
  padding = 100
) {
  const isVisible = useCallback(
    (x: number, y: number, width = 0, height = 0): boolean => {
      return (
        x + width >= -padding &&
        x <= viewportWidth + padding &&
        y + height >= -padding &&
        y <= viewportHeight + padding
      );
    },
    [viewportWidth, viewportHeight, padding]
  );

  return { isVisible };
}
