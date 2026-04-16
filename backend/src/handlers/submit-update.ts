import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { logger } from '../utils/logger';
import { AppError } from '../middleware/error-handler';

const TABLE_NAME = process.env.TABLE_NAME!;
const DEFAULT_SCORE = 29;

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const bedrockClient = new BedrockRuntimeClient({ region: 'us-east-1' });

interface SubmitUpdateRequest {
  taskId: string;
  updateText?: string;
}

interface Task {
  taskId: string;
  userId: string;
  title: string;
  description?: string;
  status: string;
}

async function assessUpdate(task: Task, updateText: string): Promise<number> {
  const prompt = `You are assessing the quality and progress of a task update.

Task Title: ${task.title}
Task Description: ${task.description || 'No description provided'}

Update Text: ${updateText}

Evaluate this update on a scale from 0-100 based on:
1. Does it show meaningful progress toward completing the task?
2. Is it specific and concrete rather than vague?
3. Does it demonstrate actual work rather than just plans or intentions?

Respond with ONLY a number between 0 and 100. No explanation.`;

  const payload = {
    anthropic_version: 'bedrock-2023-05-31',
    max_tokens: 10,
    messages: [
      {
        role: 'user',
        content: prompt
      }
    ]
  };

  const command = new InvokeModelCommand({
    modelId: 'anthropic.claude-3-haiku-20240307-v1:0',
    contentType: 'application/json',
    accept: 'application/json',
    body: JSON.stringify(payload)
  });

  try {
    const response = await bedrockClient.send(command);
    const responseBody = JSON.parse(new TextDecoder().decode(response.body));
    const scoreText = responseBody.content[0].text.trim();
    const score = parseInt(scoreText, 10);

    if (isNaN(score) || score < 0 || score > 100) {
      logger.warn('Invalid score from LLM', { scoreText, taskId: task.taskId });
      return DEFAULT_SCORE;
    }

    return score;
  } catch (error) {
    logger.error('Error calling Bedrock for assessment', { error, taskId: task.taskId });
    return DEFAULT_SCORE;
  }
}

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const userId = event.requestContext.authorizer?.claims?.sub;
    if (!userId) {
      throw new AppError('Unauthorized', 401);
    }

    const body: SubmitUpdateRequest = JSON.parse(event.body || '{}');
    const { taskId, updateText } = body;

    if (!taskId) {
      throw new AppError('taskId is required', 400);
    }

    // Get the task
    const getCommand = new GetCommand({
      TableName: TABLE_NAME,
      Key: { taskId }
    });

    const result = await docClient.send(getCommand);
    if (!result.Item) {
      throw new AppError('Task not found', 404);
    }

    const task = result.Item as Task;

    // Verify ownership
    if (task.userId !== userId) {
      throw new AppError('Forbidden', 403);
    }

    let score: number;

    // Skip scoring entirely if no update text exists
    if (!updateText || updateText.trim() === '') {
      logger.info('No update text provided, skipping assessment', { taskId });
      score = DEFAULT_SCORE;
    } else {
      // Perform full assessment with LLM
      score = await assessUpdate(task, updateText);
      logger.info('Update assessed', { taskId, score });
    }

    // Store the update with score
    const updateCommand = new UpdateCommand({
      TableName: TABLE_NAME,
      Key: { taskId },
      UpdateExpression: 'SET lastUpdate = :updateText, lastUpdateTime = :timestamp, score = :score',
      ExpressionAttributeValues: {
        ':updateText': updateText || '',
        ':timestamp': new Date().toISOString(),
        ':score': score
      },
      ReturnValues: 'ALL_NEW'
    });

    const updateResult = await docClient.send(updateCommand);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        message: 'Update submitted successfully',
        task: updateResult.Attributes,
        score
      })
    };
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    logger.error('Error submitting update', { error });
    throw new AppError('Internal server error', 500);
  }
};
