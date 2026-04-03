import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { getUserId, getUserEmail } from '../middleware/auth.js';
import { getUser, putUser } from '../services/dynamo.js';
import type { User } from '@sink-board/shared';

export const handler = async (
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResultV2> => {
  try {
    const userId = getUserId(event);
    const email = getUserEmail(event);

    let user = await getUser(userId);

    if (!user) {
      user = {
        userId,
        email,
        displayName: email.split('@')[0] ?? userId,
        score: 0,
        createdAt: new Date().toISOString(),
      };
      await putUser(user);
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(user),
    };
  } catch (err: any) {
    if (err.statusCode === 401) {
      return {
        statusCode: 401,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: err.message }),
      };
    }
    console.error('get-me error', err);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
};
