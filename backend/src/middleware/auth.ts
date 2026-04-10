import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import type { JWTPayload } from 'jose';

const COGNITO_USER_POOL_ID = process.env.COGNITO_USER_POOL_ID!;
const AWS_REGION = process.env.AWS_REGION || 'us-east-1';

// Construct the JWKS URL for AWS Cognito
const JWKS_URL = `https://cognito-idp.${AWS_REGION}.amazonaws.com/${COGNITO_USER_POOL_ID}/.well-known/jwks.json`;

// Create a remote JWK Set for signature verification
const JWKS = createRemoteJWKSet(new URL(JWKS_URL));

/**
 * Custom error class for authentication failures.
 * Provides specific error types for debugging and monitoring.
 */
export class AuthenticationError extends Error {
  constructor(
    message: string,
    public readonly code: 'MISSING_TOKEN' | 'INVALID_TOKEN' | 'EXPIRED_TOKEN' | 'VERIFICATION_FAILED',
  ) {
    super(message);
    this.name = 'AuthenticationError';
  }
}

/**
 * Extracts and validates the JWT token from the Authorization header.
 * Verifies the token signature using AWS Cognito public keys (JWKS).
 * 
 * @param event - API Gateway proxy event containing the Authorization header
 * @returns Verified JWT payload containing user claims
 * @throws {AuthenticationError} When token is missing, invalid, expired, or verification fails
 * 
 * @example
 * ```typescript
 * const payload = await verifyToken(event);
 * const userId = payload.sub; // Cognito user ID
 * const email = payload.email; // User email
 * ```
 */
export async function verifyToken(event: APIGatewayProxyEventV2): Promise<JWTPayload> {
  const authHeader = event.headers.authorization || event.headers.Authorization;

  if (!authHeader) {
    throw new AuthenticationError('Missing Authorization header', 'MISSING_TOKEN');
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    throw new AuthenticationError('Invalid Authorization header format. Expected: Bearer <token>', 'INVALID_TOKEN');
  }

  const token = parts[1];

  try {
    // Verify JWT signature and validate standard claims (exp, nbf, iat)
    const { payload } = await jwtVerify(token, JWKS, {
      issuer: `https://cognito-idp.${AWS_REGION}.amazonaws.com/${COGNITO_USER_POOL_ID}`,
      audience: undefined, // Cognito ID tokens don't use aud claim
    });

    return payload;
  } catch (error) {
    if (error instanceof Error) {
      // Check for token expiration
      if (error.message.includes('exp') || error.message.includes('expired')) {
        throw new AuthenticationError('Token has expired', 'EXPIRED_TOKEN');
      }
      // Other verification failures (invalid signature, wrong issuer, etc.)
      throw new AuthenticationError(`Token verification failed: ${error.message}`, 'VERIFICATION_FAILED');
    }
    throw new AuthenticationError('Token verification failed', 'VERIFICATION_FAILED');
  }
}

/**
 * Extracts the Cognito user ID (sub claim) from a verified JWT token.
 * Performs full signature verification before extracting the claim.
 * 
 * @param event - API Gateway proxy event containing the Authorization header
 * @returns Cognito user ID (sub claim)
 * @throws {AuthenticationError} When token verification fails
 * @throws {Error} When sub claim is missing from token
 * 
 * @example
 * ```typescript
 * export const handler = async (event: APIGatewayProxyEventV2) => {
 *   try {
 *     const userId = await getUserId(event);
 *     // Use userId for authorization checks
 *   } catch (error) {
 *     if (error instanceof AuthenticationError) {
 *       return { statusCode: 401, body: JSON.stringify({ error: error.message }) };
 *     }
 *     throw error;
 *   }
 * };
 * ```
 */
export async function getUserId(event: APIGatewayProxyEventV2): Promise<string> {
  const payload = await verifyToken(event);
  
  if (!payload.sub || typeof payload.sub !== 'string') {
    throw new Error('Token missing sub claim');
  }

  return payload.sub;
}

/**
 * Extracts the user email from a verified JWT token.
 * Performs full signature verification before extracting the claim.
 * 
 * @param event - API Gateway proxy event containing the Authorization header
 * @returns User email address from token claims
 * @throws {AuthenticationError} When token verification fails
 * @throws {Error} When email claim is missing from token
 * 
 * @example
 * ```typescript
 * const email = await getUserEmail(event);
 * // Use email for user profile operations
 * ```
 */
export async function getUserEmail(event: APIGatewayProxyEventV2): Promise<string> {
  const payload = await verifyToken(event);
  
  if (!payload.email || typeof payload.email !== 'string') {
    throw new Error('Token missing email claim');
  }

  return payload.email;
}
