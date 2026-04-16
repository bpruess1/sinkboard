import { APIGatewayProxyHandler } from 'aws-lambda';
import type { Task } from '../types';
import { docClient } from '../db';
import { v4 as uuidv4 } from 'uuid';

const TABLE_NAME = process.env.TABLE_NAME!;

// --------------- Validation Helpers ---------------

const isValidStatus = (status: string): boolean => {
  const validStatuses = ['todo', 'in_progress', 'in_review', 'blocked', 'done'];
  return validStatuses.includes(status);
};

const canMoveTask = (task: Task): { allowed: boolean; reason?: string } => {
  if (task.status === 'blocked') {
    return { allowed: false, reason: 'Cannot move blocked tasks' };
  }
  return { allowed: true };
};

// --------------- CRUD Handlers ---------------

export const createTask: APIGatewayProxyHandler = async (event) => {
  try {
    const body = JSON.parse(event.body || '{}');
    const { title, description, status = 'todo', assigneeId } = body;

    if (!title) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Title is required' }) };
    }

    if (status && !isValidStatus(status)) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Invalid status' }) };
    }

    const task: Task = {
      id: uuidv4(),
      title,
      description: description || '',
      status,
      assigneeId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await docClient.put({ TableName: TABLE_NAME, Item: task }).promise();

    return { statusCode: 201, body: JSON.stringify(task) };
  } catch (error) {
    console.error('Error creating task:', error);
    return { statusCode: 500, body: JSON.stringify({ error: 'Internal server error' }) };
  }
};

export const updateTask: APIGatewayProxyHandler = async (event) => {
  try {
    const taskId = event.pathParameters?.id;
    if (!taskId) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Task ID is required' }) };
    }

    const body = JSON.parse(event.body || '{}');
    const { title, description, status, assigneeId } = body;

    if (status && !isValidStatus(status)) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Invalid status' }) };
    }

    const getResult = await docClient.get({ TableName: TABLE_NAME, Key: { id: taskId } }).promise();
    const existingTask = getResult.Item as Task | undefined;

    if (!existingTask) {
      return { statusCode: 404, body: JSON.stringify({ error: 'Task not found' }) };
    }

    const updatedTask: Task = {
      ...existingTask,
      title: title !== undefined ? title : existingTask.title,
      description: description !== undefined ? description : existingTask.description,
      status: status !== undefined ? status : existingTask.status,
      assigneeId: assigneeId !== undefined ? assigneeId : existingTask.assigneeId,
      updatedAt: new Date().toISOString()
    };

    await docClient.put({ TableName: TABLE_NAME, Item: updatedTask }).promise();

    return { statusCode: 200, body: JSON.stringify(updatedTask) };
  } catch (error) {
    console.error('Error updating task:', error);
    return { statusCode: 500, body: JSON.stringify({ error: 'Internal server error' }) };
  }
};

export const moveTask: APIGatewayProxyHandler = async (event) => {
  try {
    const taskId = event.pathParameters?.id;
    if (!taskId) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Task ID is required' }) };
    }

    const body = JSON.parse(event.body || '{}');
    const { newPosition, newStatus } = body;

    const getResult = await docClient.get({ TableName: TABLE_NAME, Key: { id: taskId } }).promise();
    const task = getResult.Item as Task | undefined;

    if (!task) {
      return { statusCode: 404, body: JSON.stringify({ error: 'Task not found' }) };
    }

    const moveCheck = canMoveTask(task);
    if (!moveCheck.allowed) {
      return { statusCode: 403, body: JSON.stringify({ error: moveCheck.reason }) };
    }

    if (newStatus && !isValidStatus(newStatus)) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Invalid status' }) };
    }

    const updatedTask: Task = {
      ...task,
      status: newStatus !== undefined ? newStatus : task.status,
      position: newPosition !== undefined ? newPosition : task.position,
      updatedAt: new Date().toISOString()
    };

    await docClient.put({ TableName: TABLE_NAME, Item: updatedTask }).promise();

    return { statusCode: 200, body: JSON.stringify(updatedTask) };
  } catch (error) {
    console.error('Error moving task:', error);
    return { statusCode: 500, body: JSON.stringify({ error: 'Internal server error' }) };
  }
};

export const listTasks: APIGatewayProxyHandler = async () => {
  try {
    const result = await docClient.scan({ TableName: TABLE_NAME }).promise();
    return { statusCode: 200, body: JSON.stringify(result.Items || []) };
  } catch (error) {
    console.error('Error listing tasks:', error);
    return { statusCode: 500, body: JSON.stringify({ error: 'Internal server error' }) };
  }
};
