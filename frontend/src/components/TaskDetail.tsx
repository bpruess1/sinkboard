import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiClient } from '../lib/api-client';
import type { Task, TaskUpdate } from '@sink-board/shared';

const STATUS_LABELS: Record<string, string> = {
  'open': 'Open',
  'processing': 'Processing Assessment',
  'ready for review': 'Ready for Review',
  'completed': 'Completed',
};

export const TaskDetail: React.FC = () => {
  const { taskId } = useParams<{ taskId: string }>();
  const navigate = useNavigate();
  const [task, setTask] = useState<Task | null>(null);
  const [updates, setUpdates] = useState<TaskUpdate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [assessmentError, setAssessmentError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTaskAndUpdates = async () => {
      if (!taskId) return;

      try {
        setLoading(true);
        const [taskData, updatesData] = await Promise.all([
          apiClient.getTask(taskId),
          apiClient.getTaskUpdates(taskId),
        ]);
        setTask(taskData);
        setUpdates(updatesData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load task');
      } finally {
        setLoading(false);
      }
    };

    fetchTaskAndUpdates();
  }, [taskId]);

  const handleSubmitUpdate = async (content: string, hoursSpent: number) => {
    if (!taskId) return;

    try {
      setAssessmentError(null);
      const response = await apiClient.submitUpdate(taskId, { content, hoursSpent });
      
      if (response.errorMessage) {
        setAssessmentError(response.errorMessage);
      }

      const [taskData, updatesData] = await Promise.all([
        apiClient.getTask(taskId),
        apiClient.getTaskUpdates(taskId),
      ]);
      setTask(taskData);
      setUpdates(updatesData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit update');
    }
  };

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;
  if (!task) return <div>Task not found</div>;

  const statusLabel = STATUS_LABELS[task.status] || task.status;

  return (
    <div>
      <button onClick={() => navigate('/tasks')}>← Back to Tasks</button>
      <h1>{task.title}</h1>
      {task.description && <p>{task.description}</p>}
      <p>
        <strong>Status:</strong> {statusLabel}
      </p>
      <p>
        <strong>Size:</strong> {task.sizeTier}
      </p>
      <p>
        <strong>Hours Spent:</strong> {task.totalHoursSpent}
      </p>

      {assessmentError && (
        <div style={{ padding: '12px', backgroundColor: '#fff3cd', border: '1px solid #ffc107', borderRadius: '4px', marginBottom: '16px' }}>
          {assessmentError}
        </div>
      )}

      <h2>Updates</h2>
      {updates.length === 0 ? (
        <p>No updates yet</p>
      ) : (
        <ul>
          {updates.map((update) => (
            <li key={update.updateId}>
              <p>{update.content}</p>
              <p>
                <strong>Hours:</strong> {update.hoursSpent} | <strong>Score:</strong>{' '}
                {update.assessmentScore}%
              </p>
              {update.assessmentFeedback && <p><em>{update.assessmentFeedback}</em></p>}
            </li>
          ))}
        </ul>
      )}

      {task.status !== 'completed' && (
        <UpdateForm onSubmit={handleSubmitUpdate} />
      )}
    </div>
  );
};

interface UpdateFormProps {
  onSubmit: (content: string, hoursSpent: number) => Promise<void>;
}

const UpdateForm: React.FC<UpdateFormProps> = ({ onSubmit }) => {
  const [content, setContent] = useState('');
  const [hoursSpent, setHoursSpent] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() || !hoursSpent) return;

    setSubmitting(true);
    try {
      await onSubmit(content, parseFloat(hoursSpent));
      setContent('');
      setHoursSpent('');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <h3>Submit Update</h3>
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Describe your progress..."
        required
      />
      <input
        type="number"
        step="0.5"
        min="0"
        value={hoursSpent}
        onChange={(e) => setHoursSpent(e.target.value)}
        placeholder="Hours spent"
        required
      />
      <button type="submit" disabled={submitting}>
        {submitting ? 'Submitting...' : 'Submit Update'}
      </button>
    </form>
  );
};
