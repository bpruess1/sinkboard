import type { APIGatewayProxyEventV2 } from 'aws-lambda';

export function getUserId(event: APIGatewayProxyEventV2): string {
  const claims = (event.requestContext as any)?.authorizer?.jwt?.claims;
  const sub = claims?.sub;
  if (!sub) {
    throw { statusCode: 401, message: 'Unauthorized' };
  }
  return sub as string;
}

export function getUserEmail(event: APIGatewayProxyEventV2): string {
  const claims = (event.requestContext as any)?.authorizer?.jwt?.claims;
  return (claims?.email as string) ?? '';
}
