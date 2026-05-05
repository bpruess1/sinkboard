import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import { jwtVerify, importSPKI } from 'jose';

const JWT_PUBLIC_KEY = process.env.JWT_PUBLIC_KEY!;
const JWT_ISSUER = process.env.JWT_ISSUER || 'sink-board';

// --------------- Types ---------------

export interface AuthContext {
  userId: string;
  email: string;
}

export class AuthenticationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthenticationError';
  }
}

export class AuthorizationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthorizationError';
  }
}

// --------------- Token Validation ---------------

let cachedPublicKey: CryptoKey | null = null;

async function getPublicKey(): Promise<CryptoKey> {
  if (!cachedPublicKey) {
    cachedPublicKey = await importSPKI(JWT_PUBLIC_KEY, 'RS256');
  }
  return cachedPublicKey;
}

export async function verifyToken(token: string): Promise<AuthContext> {
  try {
    const publicKey = await getPublicKey();
    const { payload } = await jwtVerify(token, publicKey, {
      issuer: JWT_ISSUER,
    });

    if (!payload.sub || !payload.email) {
      throw new AuthenticationError('Invalid token payload');
    }

    return {
      userId: payload.sub,
      email: payload.email as string,
    };
  } catch (error) {
    if (error instanceof AuthenticationError) {
      throw error;
    }
    throw new AuthenticationError('Token verification failed');
  }
}

// --------------- Request Helpers ---------------

export function extractBearerToken(event: APIGatewayProxyEventV2): string | null {
  const authHeader = event.headers.authorization || event.headers.Authorization;
  if (!authHeader) {
    return null;
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return null;
  }

  return parts[1];
}

export async function authenticate(
  event: APIGatewayProxyEventV2,
): Promise<AuthContext> {
  const token = extractBearerToken(event);
  if (!token) {
    throw new AuthenticationError('Missing authorization token');
  }

  return verifyToken(token);
}

export function getUserId(event: APIGatewayProxyEventV2): string {
  const userId = event.requestContext.authorizer?.lambda?.userId;
  if (!userId) {
    throw new AuthenticationError('User ID not found in request context');
  }
  return userId;
}

export function getUserEmail(event: APIGatewayProxyEventV2): string {
  const email = event.requestContext.authorizer?.lambda?.email;
  if (!email) {
    throw new AuthenticationError('User email not found in request context');
  }
  return email;
}

// --------------- Authorization Middleware ---------------

export async function requireAuth(
  event: APIGatewayProxyEventV2,
): Promise<AuthContext> {
  return authenticate(event);
}

export function requireOwnership(resourceUserId: string, requestUserId: string): void {
  if (resourceUserId !== requestUserId) {
    throw new AuthorizationError('Insufficient permissions to access this resource');
  }
}
