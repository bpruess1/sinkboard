import { useRef, useCallback } from 'react';
import * as PIXI from 'pixi.js';

interface PooledObject<T> {
  obj: T;
  inUse: boolean;
}

interface ObjectPoolOptions<T> {
  create: () => T;
  reset: (obj: T) => void;
  initialSize?: number;
  maxSize?: number;
}

export function useObjectPool<T>(options: ObjectPoolOptions<T>) {
  const { create, reset, initialSize = 10, maxSize = 100 } = options;
  
  const poolRef = useRef<PooledObject<T>[]>([]);
  const statsRef = useRef({ created: 0, reused: 0, peak: 0 });

  // Initialize pool on first render
  if (poolRef.current.length === 0) {
    for (let i = 0; i < initialSize; i++) {
      poolRef.current.push({ obj: create(), inUse: false });
      statsRef.current.created++;
    }
  }

  const acquire = useCallback((): T => {
    // Find available object in pool
    const available = poolRef.current.find(item => !item.inUse);
    
    if (available) {
      available.inUse = true;
      reset(available.obj);
      statsRef.current.reused++;
      return available.obj;
    }

    // Create new object if under max size
    if (poolRef.current.length < maxSize) {
      const newObj = create();
      poolRef.current.push({ obj: newObj, inUse: true });
      statsRef.current.created++;
      statsRef.current.peak = Math.max(statsRef.current.peak, poolRef.current.length);
      return newObj;
    }

    // Fallback: force reuse oldest object
    const oldest = poolRef.current[0];
    reset(oldest.obj);
    oldest.inUse = true;
    return oldest.obj;
  }, [create, reset, maxSize]);

  const release = useCallback((obj: T) => {
    const item = poolRef.current.find(item => item.obj === obj);
    if (item) {
      item.inUse = false;
    }
  }, []);

  const releaseAll = useCallback(() => {
    poolRef.current.forEach(item => {
      item.inUse = false;
    });
  }, []);

  const getStats = useCallback(() => ({ ...statsRef.current }), []);

  return { acquire, release, releaseAll, getStats };
}

export function useGraphicsPool(initialSize = 20, maxSize = 100) {
  return useObjectPool<PIXI.Graphics>({
    create: () => new PIXI.Graphics(),
    reset: (graphics) => {
      graphics.clear();
      graphics.position.set(0, 0);
      graphics.alpha = 1;
      graphics.visible = true;
    },
    initialSize,
    maxSize,
  });
}
