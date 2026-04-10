import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  QueryCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import type { Task, TaskUpdate, User } from '@sink-board/shared';

const TABLE_NAME = process.env.TABLE_NAME!;

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

/**
 * Stores a new task in DynamoDB.
 * @param task - The task object to store
 */
export async function putTask(task: Task): Promise<void> {
  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: task,
    }),
  );
}

/**
 * Retrieves a task by userId and taskId.
 * @param userId - The user ID who owns the task
 * @param taskId - The task ID to retrieve
 * @returns The task object or undefined if not found
 */
export async function getTask(userId: string, taskId: string): Promise<Task | undefined> {
  const result = await docClient.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: { PK: `USER#${userId}`, SK: `TASK#${taskId}` },
    }),
  );
  return result.Item as Task | undefined;
}

/**
 * Queries all tasks for a user with pagination support.
 * @param userId - The user ID to query tasks for
 * @param limit - Maximum number of items to return (default: 20)
 * @param lastEvaluatedKey - Token from previous query for pagination
 * @returns Object containing tasks array and nextToken for pagination
 */
export async function getTasksForUser(
  userId: string,
  limit: number = 20,
  lastEvaluatedKey?: Record<string, any>,
): Promise<{ tasks: Task[]; nextToken?: string }> {
  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
      ExpressionAttributeValues: {
        ':pk': `USER#${userId}`,
        ':sk': 'TASK#',
      },
      Limit: limit,
      ExclusiveStartKey: lastEvaluatedKey,
      ScanIndexForward: false,
    }),
  );

  const tasks = (result.Items || []) as Task[];
  const nextToken = result.LastEvaluatedKey
    ? Buffer.from(JSON.stringify(result.LastEvaluatedKey)).toString('base64')
    : undefined;

  return { tasks, nextToken };
}

/**
 * Updates a task after a raise event.
 * @param userId - The user ID who owns the task
 * @param taskId - The task ID to update
 * @param newDepth - The new depth value
 * @param newRaiseCount - The new raise count
 */
export async function updateTaskAfterRaise(
  userId: string,
  taskId: string,
  newDepth: number,
  newRaiseCount: number,
): Promise<void> {
  await docClient.send(
    new UpdateCommand({
      TableName: TABLE_NAME,
      Key: { PK: `USER#${userId}`, SK: `TASK#${taskId}` },
      UpdateExpression: 'SET depth = :depth, raiseCount = :raiseCount, updatedAt = :updatedAt',
      ExpressionAttributeValues: {
        ':depth': newDepth,
        ':raiseCount': newRaiseCount,
        ':updatedAt': new Date().toISOString(),
      },
    }),
  );
}

/**
 * Stores a task update in DynamoDB.
 * @param update - The task update object to store
 */
export async function putTaskUpdate(update: TaskUpdate): Promise<void> {
  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: update,
    }),
  );
}

/**
 * Retrieves a user by userId.
 * @param userId - The user ID to retrieve
 * @returns The user object or undefined if not found
 */
export async function getUser(userId: string): Promise<User | undefined> {
  const result = await docClient.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: { PK: `USER#${userId}`, SK: 'PROFILE' },
    }),
  );
  return result.Item as User | undefined;
}

/**
 * Stores or updates a user in DynamoDB.
 * @param user - The user object to store
 */
export async function putUser(user: User): Promise<void> {
  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: user,
    }),
  );
}
