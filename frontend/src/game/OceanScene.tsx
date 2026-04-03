import { useState, useEffect, useCallback } from 'react';
import { Application, extend } from '@pixi/react';
import { Container, Graphics, Text } from 'pixi.js';
import type { Task } from '@sink-board/shared';
import { OceanBackground } from './OceanBackground';
import { ChestManager } from './ChestManager';
import { BubbleParticles } from './BubbleParticles';
import { DepthMarkers } from './DepthMarkers';
import { KrakenAnimation } from './KrakenAnimation';
import { CoinAnimation } from './CoinAnimation';
import { useTasks } from '../hooks/useTasks';
import { useUser } from '../hooks/useUser';
import { useVisibility } from '../hooks/useVisibility';
import { useKrakenTrigger } from '../hooks/useKrakenTrigger';
import { Header } from '../ui/Header';
import { TaskPanel } from '../ui/TaskPanel';
import { CreateTaskModal } from '../ui/CreateTaskModal';

// Extend pixi.js components for @pixi/react v8
extend({ Container, Graphics, Text });

export function OceanScene() {
  const [dimensions, setDimensions] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
  });
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [coinAnim, setCoinAnim] = useState<{
    startX: number;
    startY: number;
  } | null>(null);

  const { data: tasks = [] } = useTasks();
  const { data: user } = useUser();
  const isVisible = useVisibility();
  const { krakenTarget } = useKrakenTrigger(tasks, isVisible);

  useEffect(() => {
    const handleResize = () => {
      setDimensions({ width: window.innerWidth, height: window.innerHeight });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleChestClick = useCallback((task: Task) => {
    setSelectedTask(task);
  }, []);

  const handleClosePanel = useCallback(() => {
    setSelectedTask(null);
  }, []);

  const handleTaskCompleted = useCallback(
    (taskId: string) => {
      // Find the task to get its position for coin animation
      const task = tasks.find((t) => t.taskId === taskId);
      if (task) {
        // Approximate the chest position
        const hash = Math.abs(
          taskId.split('').reduce((h, c) => ((h << 5) - h + c.charCodeAt(0)) | 0, 0)
        );
        const margin = 80;
        const x = margin + (hash % Math.max(1, dimensions.width - margin * 2));
        const topMargin = dimensions.height * 0.15;
        const usableHeight = dimensions.height * 0.8;
        const y = topMargin + (task.currentDepthPercent / 100) * usableHeight;
        setCoinAnim({ startX: x, startY: y });
      }
      setSelectedTask(null);
    },
    [tasks, dimensions]
  );

  // Find kraken target position
  const krakenTargetTask = krakenTarget
    ? tasks.find((t) => t.taskId === krakenTarget)
    : null;
  let krakenX = dimensions.width / 2;
  let krakenY = dimensions.height * 0.85;
  if (krakenTargetTask) {
    const hash = Math.abs(
      krakenTargetTask.taskId
        .split('')
        .reduce((h, c) => ((h << 5) - h + c.charCodeAt(0)) | 0, 0)
    );
    const margin = 80;
    krakenX = margin + (hash % Math.max(1, dimensions.width - margin * 2));
    const topMargin = dimensions.height * 0.15;
    const usableHeight = dimensions.height * 0.8;
    krakenY = topMargin + (krakenTargetTask.currentDepthPercent / 100) * usableHeight;
  }

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden' }}>
      <Application
        width={dimensions.width}
        height={dimensions.height}
        background={0x050a12}
        antialias
      >
        <OceanBackground width={dimensions.width} height={dimensions.height} />
        <BubbleParticles width={dimensions.width} height={dimensions.height} />
        <DepthMarkers height={dimensions.height} />
        <ChestManager
          tasks={tasks}
          sceneWidth={dimensions.width}
          sceneHeight={dimensions.height}
          onChestClick={handleChestClick}
        />
        {krakenTarget && (
          <KrakenAnimation
            targetX={krakenX}
            targetY={krakenY}
            sceneHeight={dimensions.height}
            onComplete={() => {}}
          />
        )}
        {coinAnim && (
          <CoinAnimation
            startX={coinAnim.startX}
            startY={coinAnim.startY}
            endX={dimensions.width - 100}
            endY={30}
            onComplete={() => setCoinAnim(null)}
          />
        )}
      </Application>

      {/* DOM overlays */}
      <Header
        userName={user?.displayName ?? ''}
        score={user?.score ?? 0}
      />

      <button
        onClick={() => setShowCreateModal(true)}
        style={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          width: 56,
          height: 56,
          borderRadius: '50%',
          border: '2px solid var(--gold-accent)',
          background: 'rgba(13, 33, 55, 0.9)',
          color: 'var(--gold-accent)',
          fontSize: 28,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10,
          boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
        }}
        aria-label="Create new task"
      >
        +
      </button>

      {selectedTask && (
        <TaskPanel
          task={selectedTask}
          onClose={handleClosePanel}
          onCompleted={handleTaskCompleted}
        />
      )}

      {showCreateModal && (
        <CreateTaskModal onClose={() => setShowCreateModal(false)} />
      )}
    </div>
  );
}
