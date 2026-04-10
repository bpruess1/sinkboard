import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiClient } from '../lib/api-client';
import type { Task, TaskUpdate } from '@sink-board/shared';

const TaskDetail: React.FC = () => {
  const { taskId } = useParams<{ taskId: string }>();
  const navigate = useNavigate();
  const [task, setTask] = useState<Task | null>(null);
  const [updates, setUpdates] = useState<TaskUpdate[]>([]);
  const [updateText, setUpdateText] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  useEffect(() => {
    loadTask();
  }, [taskId]);

  const loadTask = async () => {
    if (!taskId) return;
    try {
      setLoading(true);
      setError(null);
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

  const handleSubmitUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskId || !updateText.trim()) return;

    try {
      setSubmitting(true);
      setError(null);
      setWarning(null);
      const response = await apiClient.submitUpdate(taskId, { updateText: updateText.trim() });
      setTask(response.task);
      setUpdates([response.update, ...updates]);
      setUpdateText('');
      
      if (response.warning) {
        setWarning(response.warning);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit update');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCompleteTask = async () => {
    if (!taskId || !confirm('Mark this task as complete?')) return;
    try {
      await apiClient.completeTask(taskId);
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to complete task');
    }
  };

  if (loading) return <div>Loading...</div>;
  if (error && !task) return <div style={{ color: 'red' }}>Error: {error}</div>;
  if (!task) return <div>Task not found</div>;

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '20px' }}>
      <button onClick={() => navigate('/')} style={{ marginBottom: '20px' }}>
        ← Back to Tasks
      </button>

      <h1>{task.title}</h1>
      {task.description && <p>{task.description}</p>}
      <p>
        <strong>Size:</strong> {task.sizeTier} | <strong>Depth:</strong> {task.currentDepth.toFixed(1)}%
      </p>
      <p>
        <strong>Status:</strong> {task.krakenTook ? '🐙 Kraken Took' : task.status}
      </p>

      {warning && (
        <div style={{ padding: '12px', backgroundColor: '#fff3cd', border: '1px solid #ffc107', borderRadius: '4px', marginBottom: '20px' }}>
          ⚠️ {warning}
        </div>
      )}

      {error && (
        <div style={{ padding: '12px', backgroundColor: '#f8d7da', border: '1px solid #dc3545', borderRadius: '4px', marginBottom: '20px' }}>
          {error}
        </div>
      )}

      {task.status === 'in_progress' && !task.krakenTook && (
        <form onSubmit={handleSubmitUpdate} style={{ marginBottom: '30px' }}>
          <textarea
            value={updateText}
            onChange={(e) => setUpdateText(e.target.value)}
            placeholder="What progress have you made?"
            rows={4}
            style={{ width: '100%', padding: '8px', marginBottom: '10px' }}
            disabled={submitting}
          />
          <button type="submit" disabled={submitting || !updateText.trim()}>
            {submitting ? 'Submitting...' : 'Submit Update'}
          </button>
        </form>
      )}

      {task.status === 'in_progress' && !task.krakenTook && (
        <button onClick={handleCompleteTask} style={{ marginBottom: '30px' }}>
          Complete Task
        </button>
      )}

      <h2>Updates</h2>
      {updates.length === 0 ? (
        <p>No updates yet.</p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {updates.map((update) => (
            <li key={update.updateId} style={{ marginBottom: '20px', padding: '15px', border: '1px solid #ddd', borderRadius: '4px' }}>
              <p>{update.updateText}</p>
              <small>
                Score: {update.assessmentScore}% | Raise: {update.raisePerc.toFixed(1)}% | Depth: {update.depthBefore.toFixed(1)}% → {update.depthAfter.toFixed(1)}%
              </small>
              <br />
              <small>{new Date(update.timestamp).toLocaleString()}</small>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default TaskDetail;
