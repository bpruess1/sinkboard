import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import type { Task, Update } from '@sink-board/shared';
import { logger } from '../utils/logger.js';

const BEDROCK_MODEL_ID = 'anthropic.claude-3-5-sonnet-20241022-v2:0';
const bedrockClient = new BedrockRuntimeClient({ region: process.env.AWS_REGION || 'us-east-1' });

const DEFAULT_NO_UPDATE_SCORE = 29;

interface AssessmentResult {
  score: number;
  reasoning: string;
  meaningfulProgress: boolean;
}

/**
 * Assess a task update using LLM.
 * If no update text exists, skip LLM assessment and return default score.
 */
export async function assessUpdate(
  task: Task,
  updateText: string | undefined,
  previousUpdates: Update[]
): Promise<AssessmentResult> {
  // Skip LLM assessment if no update text provided
  if (!updateText || updateText.trim().length === 0) {
    logger.info('No update text provided, skipping LLM assessment', {
      taskId: task.taskId,
    });
    return {
      score: DEFAULT_NO_UPDATE_SCORE,
      reasoning: 'No update text provided',
      meaningfulProgress: false,
    };
  }

  try {
    const prompt = buildAssessmentPrompt(task, updateText, previousUpdates);
    const response = await invokeLLM(prompt);
    const assessment = parseAssessmentResponse(response);

    logger.info('LLM assessment completed', {
      taskId: task.taskId,
      score: assessment.score,
      meaningfulProgress: assessment.meaningfulProgress,
    });

    return assessment;
  } catch (error) {
    logger.error('LLM assessment failed, using default score', {
      taskId: task.taskId,
      error: error instanceof Error ? error.message : String(error),
    });

    // Fallback to default score on error to maintain system reliability
    return {
      score: DEFAULT_NO_UPDATE_SCORE,
      reasoning: 'Assessment failed, using default score',
      meaningfulProgress: false,
    };
  }
}

function buildAssessmentPrompt(
  task: Task,
  updateText: string,
  previousUpdates: Update[]
): string {
  const previousContext = previousUpdates.length > 0
    ? previousUpdates
        .slice(-5) // Last 5 updates for context
        .map((u) => `- ${new Date(u.timestamp).toISOString()}: ${u.text || '(no text)'}${u.score ? ` [Score: ${u.score}]` : ''}`)
        .join('\n')
    : 'No previous updates';

  return `You are assessing progress on a development task. Evaluate whether the update represents meaningful progress.

TASK INFORMATION:
Title: ${task.title}
Description: ${task.description || 'No description provided'}
Size: ${task.sizeTier} (${task.points} points)
Current Depth: ${task.depth.toFixed(1)}%

PREVIOUS UPDATES:
${previousContext}

CURRENT UPDATE:
${updateText}

EVALUATE THIS UPDATE:
1. Does it represent tangible, meaningful progress toward completing the task?
2. Is it substantive work, or just busy work/status updates?
3. How does it compare to the task size and previous progress?

Provide your assessment as JSON:
{
  "score": <number between 0-100>,
  "meaningfulProgress": <true/false>,
  "reasoning": "<brief explanation>"
}

SCORING GUIDELINES:
- 80-100: Major breakthrough, significant feature completion, or problem solved
- 60-79: Solid progress, meaningful work completed
- 40-59: Some progress, but incomplete or minor work
- 20-39: Minimal progress, mostly planning or trivial changes
- 0-19: No meaningful progress, just status updates or blockers

Be honest and direct. Poor scores should reflect lack of actual progress, not effort.`;
}

async function invokeLLM(prompt: string): Promise<string> {
  const payload = {
    anthropic_version: 'bedrock-2023-05-31',
    max_tokens: 1000,
    messages: [
      {
        role: 'user',
        content: prompt,
      },
    ],
  };

  const command = new InvokeModelCommand({
    modelId: BEDROCK_MODEL_ID,
    contentType: 'application/json',
    accept: 'application/json',
    body: JSON.stringify(payload),
  });

  const response = await bedrockClient.send(command);
  const responseBody = JSON.parse(new TextDecoder().decode(response.body));

  if (!responseBody.content || !responseBody.content[0] || !responseBody.content[0].text) {
    throw new Error('Invalid response format from LLM');
  }

  return responseBody.content[0].text;
}

function parseAssessmentResponse(response: string): AssessmentResult {
  // Extract JSON from response (may have surrounding text)
  const jsonMatch = response.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('No JSON found in LLM response');
  }

  const parsed = JSON.parse(jsonMatch[0]);

  if (
    typeof parsed.score !== 'number' ||
    typeof parsed.meaningfulProgress !== 'boolean' ||
    typeof parsed.reasoning !== 'string'
  ) {
    throw new Error('Invalid assessment structure');
  }

  // Ensure score is within valid range and maintain fidelity
  const score = Math.max(0, Math.min(100, Math.round(parsed.score)));

  return {
    score,
    meaningfulProgress: parsed.meaningfulProgress,
    reasoning: parsed.reasoning,
  };
}
