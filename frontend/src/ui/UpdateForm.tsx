import { useState } from 'react';
import { useSubmitUpdate } from '../hooks/useTasks';

interface UpdateFormProps {
  taskId: string;
}

const textareaStyle: React.CSSProperties = {
  width: '100%',
  minHeight: 100,
  padding: '10px 12px',
  background: 'rgba(255, 255, 255, 0.06)',
  border: '1px solid rgba(255, 255, 255, 0.12)',
  borderRadius: 6,
  color: 'var(--text-primary)',
  fontSize: 14,
  resize: 'vertical',
  outline: 'none',
  fontFamily: 'inherit',
};

export function UpdateForm({ taskId }: UpdateFormProps) {
  const [content, setContent] = useState('');
  const [result, setResult] = useState<{ aiScore: number; raisePercent: number } | null>(null);
  const submitUpdate = useSubmitUpdate();

  const charCount = content.length;
  const isValid = charCount >= 10 && charCount <= 5000;

  const handleSubmit = () => {
    if (!isValid) return;
    submitUpdate.mutate(
      { taskId, content },
      {
        onSuccess: (response) => {
          setResult({ aiScore: response.aiScore, raisePercent: response.raisePercent });
          setContent('');
          setTimeout(() => setResult(null), 4000);
        },
      }
    );
  };

  return (
    <div>
      <textarea
        style={textareaStyle}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Describe your progress..."
        maxLength={5000}
        disabled={submitUpdate.isPending}
      />

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginTop: 8,
        }}
      >
        <span
          style={{
            fontSize: 12,
            fontFamily: 'monospace',
            color: charCount < 10 ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.5)',
          }}
        >
          {charCount} / 5000
        </span>

        <button
          onClick={handleSubmit}
          disabled={!isValid || submitUpdate.isPending}
          style={{
            padding: '8px 16px',
            background: isValid ? 'var(--ocean-shallow)' : 'rgba(255,255,255,0.08)',
            border: 'none',
            borderRadius: 6,
            color: '#fff',
            fontSize: 13,
            fontWeight: 600,
            opacity: isValid ? 1 : 0.4,
          }}
        >
          {submitUpdate.isPending ? 'Assessing...' : 'Submit Update'}
        </button>
      </div>

      {submitUpdate.isPending && (
        <div
          style={{
            marginTop: 12,
            padding: 12,
            background: 'rgba(79, 195, 247, 0.08)',
            borderRadius: 6,
            fontSize: 13,
            textAlign: 'center',
            color: 'var(--ocean-surface)',
          }}
        >
          <span style={{ display: 'inline-block', animation: 'spin 1s linear infinite' }}>
            ~
          </span>{' '}
          Assessing update...
        </div>
      )}

      {result && (
        <div
          style={{
            marginTop: 12,
            padding: 12,
            background: 'rgba(255, 213, 79, 0.1)',
            border: '1px solid rgba(255, 213, 79, 0.2)',
            borderRadius: 6,
            fontSize: 13,
            textAlign: 'center',
          }}
        >
          <div style={{ color: 'var(--gold-accent)', fontWeight: 700, fontSize: 18 }}>
            Score: {(result.aiScore * 100).toFixed(0)}%
          </div>
          <div style={{ marginTop: 4, color: 'var(--ocean-surface)' }}>
            Chest raised by {result.raisePercent.toFixed(1)}%
          </div>
        </div>
      )}
    </div>
  );
}
