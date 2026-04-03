import type { Task } from '@sink-board/shared';
import { TreasureChest } from './TreasureChest';
import { useSinkPosition } from '../hooks/useSinkPosition';

interface ChestManagerProps {
  tasks: Task[];
  sceneWidth: number;
  sceneHeight: number;
  onChestClick: (task: Task) => void;
}

function ChestWrapper({
  task,
  sceneWidth,
  sceneHeight,
  onClick,
}: {
  task: Task;
  sceneWidth: number;
  sceneHeight: number;
  onClick: () => void;
}) {
  const { depth } = useSinkPosition(task);

  return (
    <TreasureChest
      taskId={task.taskId}
      title={task.title}
      sizeTier={task.sizeTier}
      jewelLevel={task.jewelLevel}
      depth={depth}
      sceneWidth={sceneWidth}
      sceneHeight={sceneHeight}
      onClick={onClick}
    />
  );
}

export function ChestManager({ tasks, sceneWidth, sceneHeight, onChestClick }: ChestManagerProps) {
  const activeTasks = tasks.filter((t) => t.status === 'active');

  return (
    <pixiContainer>
      {activeTasks.map((task) => (
        <ChestWrapper
          key={task.taskId}
          task={task}
          sceneWidth={sceneWidth}
          sceneHeight={sceneHeight}
          onClick={() => onChestClick(task)}
        />
      ))}
    </pixiContainer>
  );
}
