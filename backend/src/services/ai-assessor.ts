import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { logger } from '../utils/logger.js';
import type { TaskUpdate, Task } from '@sink-board/shared';

const client = new BedrockRuntimeClient({ region: process.env.AWS_REGION || 'us-east-1' });

const MODEL_ID = 'anthropic.claude-3-5-sonnet-20241022-v2:0';
const DEFAULT_SCORE = 29;
const MAX_RETRIES = 0; // No retries - fail fast
const TIMEOUT_MS = 10000; // 10 second timeout

export interface AssessmentResult {
  score: number;
  reasoning: string;
  usedDefault: boolean;
  error?: string;
}

interface AssessmentInput {
  taskTitle: string;
  taskDescription: string;
  updateText: string;
  currentDepth: number;
}

export async function assessUpdate(
  task: Task,
  update: TaskUpdate,
  currentDepth: number,
): Promise<AssessmentResult> {
  const input: AssessmentInput = {
    taskTitle: task.title,
    taskDescription: task.description || '',
    updateText: update.text,
    currentDepth,
  };

  try {
    const result = await assessWithTimeout(input, TIMEOUT_MS);
    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('AI assessment failed, using default score', {
      taskId: task.taskId,
      updateId: update.updateId,
      error: errorMessage,
    });

    return {
      score: DEFAULT_SCORE,
      reasoning: 'Assessment scoring is unavailable. Assigning default score.',
      usedDefault: true,
      error: errorMessage,
    };
  }
}

async function assessWithTimeout(
  input: AssessmentInput,
  timeoutMs: number,
): Promise<AssessmentResult> {
  return Promise.race([
    performAssessment(input),
    new Promise<AssessmentResult>((_, reject) =>
      setTimeout(() => reject(new Error('Assessment timeout')), timeoutMs)
    ),
  ]);
}

async function performAssessment(input: AssessmentInput): Promise<AssessmentResult> {
  const prompt = buildPrompt(input);

  const command = new InvokeModelCommand({
    modelId: MODEL_ID,
    contentType: 'application/json',
    accept: 'application/json',
    body: JSON.stringify({
      anthropic_version: 'bedrock-2023-05-31',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.3,
    }),
  });

  let attempt = 0;
  let lastError: Error | null = null;

  while (attempt <= MAX_RETRIES) {
    try {
      const response = await client.send(command);
      const responseBody = JSON.parse(new TextDecoder().decode(response.body));

      if (!responseBody.content || !responseBody.content[0] || !responseBody.content[0].text) {
        throw new Error('Invalid response format from AI model');
      }

      const responseText = responseBody.content[0].text;
      const parsed = parseAssessmentResponse(responseText);

      return {
        score: parsed.score,
        reasoning: parsed.reasoning,
        usedDefault: false,
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown error');
      attempt++;

      if (attempt <= MAX_RETRIES) {
        logger.warn('AI assessment attempt failed, retrying', {
          attempt,
          maxRetries: MAX_RETRIES,
          error: lastError.message,
        });
        await sleep(Math.pow(2, attempt) * 1000); // Exponential backoff
      }
    }
  }

  throw lastError || new Error('Assessment failed after retries');
}

function buildPrompt(input: AssessmentInput): string {
  return `You are assessing progress updates for a task management system called "Sinkboard" that uses a depth metaphor.

Task: ${input.taskTitle}
Description: ${input.taskDescription}
Current Depth: ${input.currentDepth} fathoms

Update from user:
${input.updateText}

Assess this update and provide:
1. A score from 0-100 representing how much this update reduces the task's depth (raises it toward completion)
2. Brief reasoning for your score

Respond in this exact JSON format:
{
  "score": <number 0-100>,
  "reasoning": "<your explanation>"
}`;
}

function parseAssessmentResponse(responseText: string): { score: number; reasoning: string } {
  try {
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }

    const parsed = JSON.parse(jsonMatch[0]);

    if (typeof parsed.score !== 'number' || parsed.score < 0 || parsed.score > 100) {
      throw new Error('Invalid score in response');
    }

    if (typeof parsed.reasoning !== 'string') {
      throw new Error('Invalid reasoning in response');
    }

    return {
      score: Math.round(parsed.score),
      reasoning: parsed.reasoning,
    };
  } catch (error) {
    throw new Error(`Failed to parse assessment response: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
