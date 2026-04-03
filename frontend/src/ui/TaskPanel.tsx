import { useState } from 'react';
import type { Task } from '@sink-board/shared';
import { TIER_VALUES, TIER_SINK_HOURS } from '@sink-board/shared';
import { useSinkPosition } from '../hooks/useSinkPosition';
import { useCompleteTask } from '../hooks/useTasks';
import { UpdateForm } from './UpdateForm';

interface TaskPanelProps {
  task: Task;
  onClose: () => void;
  onCompleted: (taskId: string) => void;
}

const panelStyle: React.CSSProperties = {
  position: 'fixed',
  top: 48,
  right: 0,
  bottom: 0,
  width: 360,
  maxWidth: '100vw',
  background: 'rgba(13, 33, 55, 0.95)',
  borderLeft: '1px solid rgba(79, 195, 247, 0.15)',
  backdropFilter: 'blur(12px)',
  zIndex: 25,
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
};

const headerStyle: React.CSSProperties = {
  padding: '16px 16px 12px',
  borderBottom: '1px solid rgba(255,255,255,0.08)',
};

const bodyStyle: React.CSSProperties = {
  flex: 1,
  overflowY: 'auto',
  padding: 16,
};

const statStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  padding: '6px 0',
  fontSize: 13,
  borderBottom: '1px solid rgba(255,255,255,0.04)',
};

export function TaskPanel({ task, onClose, onCompleted }: TaskPanelProps) {
  const { depth } = useSinkPosition(task);
  const completeTask = useCompleteTask();
  const [confirmComplete, setConfirmComplete] = useState(false);

  const handleComplete = () => {
    if (!confirmComplete) {
      setConfirmComplete(true);
      return;
    }
    completeTask.mutate(task.taskId, {
      onSuccess: () => onCompleted(task.taskId),
    });
  };

  const hoursRemaining = ((100 - depth) / 100) * TIER_SINK_HOURS[task.sizeTier];

  return (
    <div style={panelStyle}>
      <div style={headerStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <h2 style={{ margin: 0, fontSize: 16, color: 'var(--ocean-surface)', flex: 1, marginRight: 8 }}>
            {task.title}
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-primary)',
              fontSize: 20,
              padding: '0 4px',
              opacity: 0.6,
            }}
            aria-label="Close panel"
          >
            x
          </button>
        </div>
        {task.description && (
          <p style={{ margin: '8px 0 0', fontSize: 13, opacity: 0.7, lineHeight: 1.4 }}>
            {task.description}
          </p>
        )}
      </div>

      <div style={bodyStyle}>
        <div style={{ marginBottom: 16 }}>
          <div style={statStyle}>
            <span style={{ opacity: 0.6 }}>Size</span>
            <span>
              {task.sizeTier} ({TIER_VALUES[task.sizeTier]} pts)
            </span>
          </div>
          <div style={statStyle}>
            <span style={{ opacity: 0.6 }}>Depth</span>
            <span
              style={{
                fontFamily: 'monospace',
                color: depth > 80 ? 'var(--kraken-red)' : depth > 50 ? 'var(--gold-accent)' : 'var(--text-primary)',
              }}
            >
              {depth.toFixed(1)}%
            </span>
          </div>
          <div style={statStyle}>
            <span style={{ opacity: 0.6 }}>Time remaining</span>
            <span style={{ fontFamily: 'monospace' }}>
              {hoursRemaining > 24
                ? `${(hoursRemaining / 24).toFixed(1)} days`
                : `${hoursRemaining.toFixed(1)} hrs`}
            </span>
          </div>
          <div style={statStyle}>
            <span style={{ opacity: 0.6 }}>Jewel level</span>
            <span>{task.jewelLevel}</span>
          </div>
          <div style={statStyle}>
            <span style={{ opacity: 0.6 }}>Kraken attacks</span>
            <span style={{ color: task.krakenCount > 0 ? 'var(--kraken-red)' : 'inherit' }}>
              {task.krakenCount}
            </span>
          </div>
        </div>

        {task.status === 'active' && (
          <button
            onClick={handleComplete}
            disabled={completeTask.isPending}
            style={{
              width: '100%',
              padding: '10px 0',
              border: confirmComplete ? '2px solid var(--gold-accent)' : '1px solid rgba(255,255,255,0.15)',
              borderRadius: 6,
              background: confirmComplete ? 'rgba(255, 213, 79, 0.15)' : 'rgba(255,255,255,0.04)',
              color: confirmComplete ? 'var(--gold-accent)' : 'var(--text-primary)',
              fontSize: 14,
              fontWeight: 600,
              marginBottom: 20,
            }}
          >
            {completeTask.isPending
              ? 'Completing...'
              : confirmComplete
                ? 'Confirm Complete?'
                : 'Complete Task'}
          </button>
        )}

        <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 16 }}>
          <h3 style={{ margin: '0 0 12px', fontSize: 14, opacity: 0.7 }}>Submit Update</h3>
          <UpdateForm taskId={task.taskId} />
        </div>
      </div>
    </div>
  );
}
