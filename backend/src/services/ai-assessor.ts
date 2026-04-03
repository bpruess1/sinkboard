import Anthropic from '@anthropic-ai/sdk';
import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm';
import { ANTHROPIC_KEY_PARAM } from '@sink-board/shared';

const ssm = new SSMClient({});

let cachedApiKey: string | undefined;

async function getApiKey(): Promise<string> {
  if (cachedApiKey) return cachedApiKey;
  const result = await ssm.send(
    new GetParameterCommand({
      Name: ANTHROPIC_KEY_PARAM,
      WithDecryption: true,
    }),
  );
  cachedApiKey = result.Parameter!.Value!;
  return cachedApiKey;
}

interface AssessmentResult {
  score: number;
  reason: string;
}

const SYSTEM_PROMPT =
  'You are a task update quality assessor. Given a task and a user\'s progress update, score the quality from 0.0 to 1.0. Criteria: specificity (mentions concrete actions taken), progress (shows meaningful work done), substance (not filler/fluff). Return ONLY valid JSON: {"score": number, "reason": "brief explanation"}';

export async function assessUpdate(
  taskTitle: string,
  taskDescription: string,
  updateContent: string,
): Promise<AssessmentResult> {
  const fallback: AssessmentResult = { score: 0.5, reason: 'Unable to assess' };

  try {
    const apiKey = await getApiKey();
    const anthropic = new Anthropic({ apiKey });

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20241022',
      max_tokens: 150,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: `Task: ${taskTitle}\nDescription: ${taskDescription}\nUpdate: ${updateContent}`,
        },
      ],
    });

    const text =
      response.content[0].type === 'text' ? response.content[0].text : '';
    const parsed = JSON.parse(text);

    if (typeof parsed.score !== 'number' || typeof parsed.reason !== 'string') {
      return fallback;
    }

    return {
      score: Math.min(1, Math.max(0, parsed.score)),
      reason: parsed.reason,
    };
  } catch {
    return fallback;
  }
}
