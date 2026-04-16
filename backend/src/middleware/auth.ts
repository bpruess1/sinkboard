import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import jwt from 'jsonwebtoken';
import jwksClient from 'jwks-rsa';

const COGNITO_USER_POOL_ID = process.env.COGNITO_USER_POOL_ID!;
const AWS_REGION = process.env.AWS_REGION!;
const COGNITO_ISSUER = `https://cognito-idp.${AWS_REGION}.amazonaws.com/${COGNITO_USER_POOL_ID}`;

// --------------- JWKS Client Setup -------
const jwksClientInstance = jwksClient({
  jwksUri: `${COGNITO_ISSUER}/.well-known/jwks.json`,
  cache: true,
  cacheMaxAge: 86400000, // 24 hours in ms
});

interface CognitoTokenPayload {
  sub: string;
  token_use: string;
  iss: string;
  exp: number;
  iat: number;
  'cognito:username': string;
}

/**
 * Retrieves the signing key for JWT verification.
 * Used by jsonwebtoken to validate token signature.
 */
function getSigningKey(header: jwt.JwtHeader, callback: jwt.SigningKeyCallback): void {
  jwksClientInstance.getSigningKey(header.kid, (err, key) => {
    if (err) {
      callback(err);
      return;
    }
    const signingKey = key?.getPublicKey();
    callback(null, signingKey);
  });
}

/**
 * Validates and decodes a Cognito JWT token.
 * 
 * Security guarantees:
 * - Signature verification using JWKS public keys from Cognito
 * - Expiry validation (exp claim)
 * - Issuer validation (iss claim matches Cognito user pool)
 * - Token use validation (must be 'id' token)
 * 
 * @throws Error if token is invalid, expired, or verification fails
 */
export async function verifyToken(token: string): Promise<CognitoTokenPayload> {
  return new Promise((resolve, reject) => {
    jwt.verify(
      token,
      getSigningKey,
      {
        issuer: COGNITO_ISSUER,
        algorithms: ['RS256'],
      },
      (err, decoded) => {
        if (err) {
          reject(new Error(`Token verification failed: ${err.message}`));
          return;
        }

        const payload = decoded as CognitoTokenPayload;

        // --------------- Token Use Validation -------
        if (payload.token_use !== 'id') {
          reject(new Error('Token must be an id token'));
          return;
        }

        // --------------- Expiry Check -------
        const now = Math.floor(Date.now() / 1000);
        if (payload.exp < now) {
          reject(new Error('Token has expired'));
          return;
        }

        resolve(payload);
      }
    );
  });
}

/**
 * Extracts and validates user ID from API Gateway event.
 * 
 * Authorizer flow:
 * 1. API Gateway receives request with Authorization header
 * 2. Lambda authorizer (configured separately) validates token
 * 3. Authorizer passes userId in requestContext.authorizer.claims.sub
 * 4. This function extracts userId from claims
 * 
 * For direct JWT validation (when authorizer is not configured),
 * falls back to manual token verification.
 * 
 * @throws Error if authorization fails or token is invalid
 */
export async function getUserId(event: APIGatewayProxyEventV2): Promise<string> {
  // --------------- Try Authorizer Claims First -------
  const authorizerClaims = event.requestContext?.authorizer?.jwt?.claims;
  if (authorizerClaims?.sub) {
    return authorizerClaims.sub as string;
  }

  // --------------- Fallback: Manual JWT Validation -------
  const authHeader = event.headers.authorization || event.headers.Authorization;
  if (!authHeader) {
    throw new Error('Missing authorization header');
  }

  const token = authHeader.replace(/^Bearer\s+/i, '');
  if (!token) {
    throw new Error('Invalid authorization format');
  }

  const payload = await verifyToken(token);
  return payload.sub;
}
