import { APIGatewayProxyEvent } from 'aws-lambda';
import { handler } from '../submit-update';
import { mockClient } from 'aws-sdk-client-mock';
import { DynamoDBDocumentClient, GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';

const dynamoMock = mockClient(DynamoDBDocumentClient);
const bedrockMock = mockClient(BedrockRuntimeClient);

const DEFAULT_SCORE = 29;

const mockTask = {
  taskId: 'task-123',
  userId: 'user-123',
  title: 'Test Task',
  description: 'Test description',
  status: 'in-progress'
};

const createMockEvent = (body: any): APIGatewayProxyEvent => ({
  body: JSON.stringify(body),
  requestContext: {
    authorizer: {
      claims: {
        sub: 'user-123'
      }
    }
  } as any,
  headers: {},
  multiValueHeaders: {},
  httpMethod: 'POST',
  isBase64Encoded: false,
  path: '/tasks/update',
  pathParameters: null,
  queryStringParameters: null,
  multiValueQueryStringParameters: null,
  stageVariables: null,
  resource: ''
});

describe('submit-update handler', () => {
  beforeEach(() => {
    dynamoMock.reset();
    bedrockMock.reset();
    process.env.TABLE_NAME = 'test-table';
  });

  it('should skip scoring when no update text is provided', async () => {
    dynamoMock.on(GetCommand).resolves({ Item: mockTask });
    dynamoMock.on(UpdateCommand).resolves({ Attributes: { ...mockTask, score: DEFAULT_SCORE } });

    const event = createMockEvent({
      taskId: 'task-123',
      updateText: ''
    });

    const result = await handler(event);

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.score).toBe(DEFAULT_SCORE);

    // Verify Bedrock was NOT called
    expect(bedrockMock.calls()).toHaveLength(0);
  });

  it('should skip scoring when updateText is undefined', async () => {
    dynamoMock.on(GetCommand).resolves({ Item: mockTask });
    dynamoMock.on(UpdateCommand).resolves({ Attributes: { ...mockTask, score: DEFAULT_SCORE } });

    const event = createMockEvent({
      taskId: 'task-123'
    });

    const result = await handler(event);

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.score).toBe(DEFAULT_SCORE);

    // Verify Bedrock was NOT called
    expect(bedrockMock.calls()).toHaveLength(0);
  });

  it('should perform assessment when update text is provided', async () => {
    dynamoMock.on(GetCommand).resolves({ Item: mockTask });
    dynamoMock.on(UpdateCommand).resolves({ Attributes: { ...mockTask, score: 85 } });

    const mockBedrockResponse = {
      body: new TextEncoder().encode(JSON.stringify({
        content: [{ text: '85' }]
      }))
    };
    bedrockMock.on(InvokeModelCommand).resolves(mockBedrockResponse);

    const event = createMockEvent({
      taskId: 'task-123',
      updateText: 'Completed the feature implementation'
    });

    const result = await handler(event);

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.score).toBe(85);

    // Verify Bedrock WAS called
    expect(bedrockMock.calls()).toHaveLength(1);
  });

  it('should return 404 when task does not exist', async () => {
    dynamoMock.on(GetCommand).resolves({});

    const event = createMockEvent({
      taskId: 'nonexistent-task',
      updateText: 'Some update'
    });

    await expect(handler(event)).rejects.toThrow('Task not found');
  });

  it('should return 403 when user does not own the task', async () => {
    dynamoMock.on(GetCommand).resolves({ Item: { ...mockTask, userId: 'different-user' } });

    const event = createMockEvent({
      taskId: 'task-123',
      updateText: 'Some update'
    });

    await expect(handler(event)).rejects.toThrow('Forbidden');
  });
});
