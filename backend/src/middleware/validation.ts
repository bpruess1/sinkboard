import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import type { ZodSchema } from 'zod';

type Handler<T> = (
  event: APIGatewayProxyEventV2,
  body: T,
) => Promise<APIGatewayProxyResultV2>;

export function validateBody<T>(
  schema: ZodSchema<T>,
  handler: Handler<T>,
): (event: APIGatewayProxyEventV2) => Promise<APIGatewayProxyResultV2> {
  return async (event: APIGatewayProxyEventV2) => {
    let raw: unknown;
    try {
      raw = JSON.parse(event.body ?? '');
    } catch {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Invalid JSON in request body' }),
      };
    }

    const result = schema.safeParse(raw);
    if (!result.success) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: result.error.issues.map((i) => i.message).join('; '),
        }),
      };
    }

    return handler(event, result.data);
  };
}
