import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import type { User, Task, TaskUpdate } from '@sink-board/shared';

const client = new DynamoDBClient({});
export const docClient = DynamoDBDocumentClient.from(client, {
  marshallOptions: { removeUndefinedValues: true },
});

const TABLE_NAME = process.env.TABLE_NAME!;

// --------------- User operations ---------------

export async function getUser(userId: string): Promise<User | undefined> {
  const result = await docClient.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: { PK: `USER#${userId}`, SK: 'PROFILE' },
    }),
  );
  return result.Item as User | undefined;
}

export async function putUser(user: User): Promise<void> {
  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        PK: `USER#${user.userId}`,
        SK: 'PROFILE',
        GSI1PK: `EMAIL#${user.email}`,
        GSI1SK: 'USER',
        ...user,
      },
    }),
  );
}

export async function updateUserScore(userId: string, delta: number): Promise<number> {
  const result = await docClient.send(
    new UpdateCommand({
      TableName: TABLE_NAME,
      Key: { PK: `USER#${userId}`, SK: 'PROFILE' },
      UpdateExpression: 'SET score = if_not_exists(score, :zero) + :delta',
      ExpressionAttributeValues: { ':delta': delta, ':zero': 0 },
      ReturnValues: 'UPDATED_NEW',
    }),
  );
  let newScore = (result.Attributes?.score as number) ?? 0;
  // Clamp to 0 minimum — if the update pushed score negative, fix it
  if (newScore < 0) {
    const fix = await docClient.send(
      new UpdateCommand({
        TableName: TABLE_NAME,
        Key: { PK: `USER#${userId}`, SK: 'PROFILE' },
        UpdateExpression: 'SET score = :zero',
        ExpressionAttributeValues: { ':zero': 0 },
        ReturnValues: 'UPDATED_NEW',
      }),
    );
    newScore = 0;
  }
  return newScore;
}

// --------------- Task operations ---------------

export async function getTasksForUser(userId: string): Promise<Task[]> {
  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
      ExpressionAttributeValues: {
        ':pk': `USER#${userId}`,
        ':sk': 'TASK#',
      },
    }),
  );
  return (result.Items ?? []) as Task[];
}

export async function getTask(userId: string, taskId: string): Promise<Task | undefined> {
  const result = await docClient.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: { PK: `USER#${userId}`, SK: `TASK#${taskId}` },
    }),
  );
  return result.Item as Task | undefined;
}

interface TaskRecord extends Task {
  PK: string;
  SK: string;
  GSI1PK: string;
  GSI1SK: string;
}

export async function putTask(task: Task): Promise<void> {
  const item: TaskRecord = {
    ...task,
    PK: `USER#${task.userId}`,
    SK: `TASK#${task.taskId}`,
    GSI1PK: `TASK#${task.taskId}`,
    GSI1SK: 'TASK',
  };
  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: item,
    }),
  );
}

export async function updateTaskAfterRaise(
  userId: string,
  taskId: string,
  newDepth: number,
  lastRaisedAt: string,
): Promise<void> {
  await docClient.send(
    new UpdateCommand({
      TableName: TABLE_NAME,
      Key: { PK: `USER#${userId}`, SK: `TASK#${taskId}` },
      UpdateExpression: 'SET currentDepthPercent = :depth, lastRaisedAt = :ts',
      ExpressionAttributeValues: {
        ':depth': newDepth,
        ':ts': lastRaisedAt,
      },
    }),
  );
}

export async function updateTaskAfterKraken(
  userId: string,
  taskId: string,
  newKrakenCount: number,
): Promise<void> {
  await docClient.send(
    new UpdateCommand({
      TableName: TABLE_NAME,
      Key: { PK: `USER#${userId}`, SK: `TASK#${taskId}` },
      UpdateExpression:
        'SET currentDepthPercent = :zero, lastRaisedAt = :now, krakenCount = :kc',
      ExpressionAttributeValues: {
        ':zero': 0,
        ':now': new Date().toISOString(),
        ':kc': newKrakenCount,
      },
    }),
  );
}

export async function completeTask(userId: string, taskId: string): Promise<void> {
  await docClient.send(
    new UpdateCommand({
      TableName: TABLE_NAME,
      Key: { PK: `USER#${userId}`, SK: `TASK#${taskId}` },
      UpdateExpression: 'SET #status = :status',
      ExpressionAttributeNames: { '#status': 'status' },
      ExpressionAttributeValues: { ':status': 'completed' },
    }),
  );
}

// --------------- TaskUpdate operations ---------------

export async function putTaskUpdate(update: TaskUpdate): Promise<void> {
  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        PK: `TASK#${update.taskId}`,
        SK: `UPDATE#${update.createdAt}#${update.updateId}`,
        GSI1PK: `USER#${update.userId}`,
        GSI1SK: `UPDATE#${update.createdAt}`,
        ...update,
      },
    }),
  );
}

export async function getTaskUpdates(taskId: string): Promise<TaskUpdate[]> {
  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
      ExpressionAttributeValues: {
        ':pk': `TASK#${taskId}`,
        ':sk': 'UPDATE#',
      },
    }),
  );
  return (result.Items ?? []) as TaskUpdate[];
}
