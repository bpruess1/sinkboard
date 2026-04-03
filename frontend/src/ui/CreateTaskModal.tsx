import { useState } from 'react';
import type { SizeTier } from '@sink-board/shared';
import { TIER_VALUES } from '@sink-board/shared';
import { useCreateTask } from '../hooks/useTasks';

interface CreateTaskModalProps {
  onClose: () => void;
}

const TIERS: { tier: SizeTier; label: string }[] = [
  { tier: 'S', label: 'Small' },
  { tier: 'M', label: 'Medium' },
  { tier: 'L', label: 'Large' },
  { tier: 'XL', label: 'XL' },
];

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0, 0, 0, 0.6)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 30,
};

const modalStyle: React.CSSProperties = {
  background: 'rgba(13, 33, 55, 0.95)',
  border: '1px solid rgba(79, 195, 247, 0.2)',
  borderRadius: 12,
  padding: 24,
  width: '90%',
  maxWidth: 420,
  backdropFilter: 'blur(12px)',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  background: 'rgba(255, 255, 255, 0.06)',
  border: '1px solid rgba(255, 255, 255, 0.12)',
  borderRadius: 6,
  color: 'var(--text-primary)',
  fontSize: 14,
  outline: 'none',
};

const textareaStyle: React.CSSProperties = {
  ...inputStyle,
  minHeight: 80,
  resize: 'vertical' as const,
};

export function CreateTaskModal({ onClose }: CreateTaskModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [sizeTier, setSizeTier] = useState<SizeTier>('M');
  const createTask = useCreateTask();

  const handleSubmit = () => {
    if (!title.trim()) return;
    createTask.mutate(
      { title: title.trim(), description: description.trim() || undefined, sizeTier },
      { onSuccess: () => onClose() }
    );
  };

  return (
    <div style={overlayStyle} onClick={onClose} role="dialog" aria-modal="true" aria-label="Create new task">
      <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
        <h2 style={{ margin: '0 0 16px', fontSize: 18, color: 'var(--ocean-surface)' }}>
          New Treasure Chest
        </h2>

        <label style={{ display: 'block', marginBottom: 12 }}>
          <span style={{ display: 'block', marginBottom: 4, fontSize: 13, opacity: 0.7 }}>
            Title
          </span>
          <input
            style={inputStyle}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="What needs to be done?"
            maxLength={100}
            autoFocus
          />
        </label>

        <label style={{ display: 'block', marginBottom: 16 }}>
          <span style={{ display: 'block', marginBottom: 4, fontSize: 13, opacity: 0.7 }}>
            Description (optional)
          </span>
          <textarea
            style={textareaStyle}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Add details..."
            maxLength={500}
          />
        </label>

        <div style={{ marginBottom: 20 }}>
          <span style={{ display: 'block', marginBottom: 8, fontSize: 13, opacity: 0.7 }}>
            Size
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            {TIERS.map(({ tier, label }) => {
              const isSelected = sizeTier === tier;
              return (
                <button
                  key={tier}
                  onClick={() => setSizeTier(tier)}
                  style={{
                    flex: 1,
                    padding: '10px 4px',
                    border: isSelected
                      ? '2px solid var(--gold-accent)'
                      : '1px solid rgba(255,255,255,0.12)',
                    borderRadius: 8,
                    background: isSelected
                      ? 'rgba(255, 213, 79, 0.1)'
                      : 'rgba(255, 255, 255, 0.04)',
                    color: isSelected ? 'var(--gold-accent)' : 'var(--text-primary)',
                    textAlign: 'center' as const,
                    fontSize: 12,
                    lineHeight: 1.4,
                  }}
                  aria-pressed={isSelected}
                >
                  <div style={{ fontSize: 18, fontWeight: 700 }}>{tier}</div>
                  <div style={{ opacity: 0.7 }}>
                    {label} ({TIER_VALUES[tier]}pt)
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{
              padding: '8px 16px',
              background: 'transparent',
              border: '1px solid rgba(255,255,255,0.15)',
              borderRadius: 6,
              color: 'var(--text-primary)',
              fontSize: 14,
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!title.trim() || createTask.isPending}
            style={{
              padding: '8px 20px',
              background: title.trim()
                ? 'var(--ocean-shallow)'
                : 'rgba(255,255,255,0.08)',
              border: 'none',
              borderRadius: 6,
              color: '#fff',
              fontSize: 14,
              fontWeight: 600,
              opacity: title.trim() ? 1 : 0.5,
            }}
          >
            {createTask.isPending ? 'Creating...' : 'Drop Chest'}
          </button>
        </div>
      </div>
    </div>
  );
}
