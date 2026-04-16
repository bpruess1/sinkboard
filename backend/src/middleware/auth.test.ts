import { verifyToken, getUserId } from './auth';
import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import jwt from 'jsonwebtoken';
import jwksClient from 'jwks-rsa';

jest.mock('jwks-rsa');

const mockGetSigningKey = jest.fn();
(jwksClient as jest.Mock).mockReturnValue({
  getSigningKey: mockGetSigningKey,
});

const MOCK_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA0Z3VS5JJcds3xfn/ygWZ
xKYZ6VBgKkXvn7dKFQzL2QwVLYgJCYF2p1Z6t1ygZJjLXE6ywLJIzJjBfGKvFQHg
KkqiwELKRqXIj6lZiSFxPHfXgvHaQWXJrJvEVh1qsV5XKXVZLZQD+ljZtC8jLJCE
P9LKPPKSYFqQDJJCfCKLb1LZXJLqQqJSLZKQFJSLZKQFJSLZKQFJSLZKQFJSLZKQ
FJSLZKQFJSLZKQFJSLZKQFJSLZKQFJSLZKQFJSLZKQFJSLZKQFJSLZKQFJSLZKQF
JSLZKQFJSLZKQFJSLZKQFJSLZKQFJSLZKQFJSLZKQFJSLZKQFJSLZKQFJSLZKQFJ
SQIDAQAB
-----END PUBLIC KEY-----`;

const MOCK_PRIVATE_KEY = `-----BEGIN RSA PRIVATE KEY-----
MIIEpAIBAAKCAQEA0Z3VS5JJcds3xfn/ygWZxKYZ6VBgKkXvn7dKFQzL2QwVLYgJ
CYF2p1Z6t1ygZJjLXE6ywLJIzJjBfGKvFQHgKkqiwELKRqXIj6lZiSFxPHfXgvHa
QWXJrJvEVh1qsV5XKXVZLZQD+ljZtC8jLJCEP9LKPPKSYFqQDJJCfCKLb1LZXJLQ
qJSLZKQFJSLZKQFJSLZKQFJSLZKQFJSLZKQFJSLZKQFJSLZKQFJSLZKQFJSLZKQF
JSLZKQFJSLZKQFJSLZKQFJSLZKQFJSLZKQFJSLZKQFJSLZKQFJSLZKQFJSLZKQFJ
SLZKQFJSLZKQFJSLZKQFJSLZKQFJSLZKQFJSLZKQFJSLZKQFJSLZKQFJSQIDAQAB
AoGAXxKZ0+LjKQFJSLZKQFJSLZKQFJSLZKQFJSLZKQFJSLZKQFJSLZKQFJSLZKQF
JSLZKQFJSLZKQFJSLZKQFJSLZKQFJSLZKQFJSLZKQFJSLZKQFJSLZKQFJSLZKQFJ
SLZKQFJSLZKQFJSLZKQFJSLZKQFJSLZKQFJSLZKQFJSLZKQFJSLZKQFJSLZKQFJS
LZKQFJSLZKQFJSLZKQFJSLZKQFJSLZKQFJSLZKQFJSLZKQFJSLZKQFJSLZKQFJSL
ZKQFJSLZKQFJSLZKQFJSLZKQFJSLZKQFJSLZKQFJSLZKQFJSLZKQ==
-----END RSA PRIVATE KEY-----`;

process.env.COGNITO_USER_POOL_ID = 'us-east-1_test123';
process.env.AWS_REGION = 'us-east-1';

describe('JWT Token Validation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetSigningKey.mockImplementation((kid: string, callback: (err: Error | null, key?: { getPublicKey: () => string }) => void) => {
      callback(null, { getPublicKey: () => MOCK_PUBLIC_KEY });
    });
  });

  describe('verifyToken', () => {
    it('rejects expired tokens', async () => {
      const expiredToken = jwt.sign(
        {
          sub: 'user-123',
          token_use: 'id',
          iss: `https://cognito-idp.us-east-1.amazonaws.com/us-east-1_test123`,
          exp: Math.floor(Date.now() / 1000) - 3600, // 1 hour ago
          iat: Math.floor(Date.now() / 1000) - 7200,
          'cognito:username': 'testuser',
        },
        MOCK_PRIVATE_KEY,
        { algorithm: 'RS256', keyid: 'test-key-id' }
      );

      await expect(verifyToken(expiredToken)).rejects.toThrow('expired');
    });

    it('rejects tokens with invalid signature', async () => {
      mockGetSigningKey.mockImplementation((kid: string, callback: (err: Error | null) => void) => {
        callback(new Error('Invalid signature'));
      });

      const token = 'invalid.token.signature';
      await expect(verifyToken(token)).rejects.toThrow('verification failed');
    });

    it('rejects non-id tokens', async () => {
      const accessToken = jwt.sign(
        {
          sub: 'user-123',
          token_use: 'access', // Wrong type
          iss: `https://cognito-idp.us-east-1.amazonaws.com/us-east-1_test123`,
          exp: Math.floor(Date.now() / 1000) + 3600,
          iat: Math.floor(Date.now() / 1000),
        },
        MOCK_PRIVATE_KEY,
        { algorithm: 'RS256', keyid: 'test-key-id' }
      );

      await expect(verifyToken(accessToken)).rejects.toThrow('must be an id token');
    });

    it('accepts valid tokens', async () => {
      const validToken = jwt.sign(
        {
          sub: 'user-123',
          token_use: 'id',
          iss: `https://cognito-idp.us-east-1.amazonaws.com/us-east-1_test123`,
          exp: Math.floor(Date.now() / 1000) + 3600,
          iat: Math.floor(Date.now() / 1000),
          'cognito:username': 'testuser',
        },
        MOCK_PRIVATE_KEY,
        { algorithm: 'RS256', keyid: 'test-key-id' }
      );

      const payload = await verifyToken(validToken);
      expect(payload.sub).toBe('user-123');
      expect(payload['cognito:username']).toBe('testuser');
    });
  });

  describe('getUserId', () => {
    it('extracts userId from authorizer claims', async () => {
      const event = {
        requestContext: {
          authorizer: {
            jwt: {
              claims: {
                sub: 'user-from-authorizer',
              },
            },
          },
        },
      } as unknown as APIGatewayProxyEventV2;

      const userId = await getUserId(event);
      expect(userId).toBe('user-from-authorizer');
    });

    it('throws error when authorization header is missing', async () => {
      const event = {
        headers: {},
        requestContext: {},
      } as APIGatewayProxyEventV2;

      await expect(getUserId(event)).rejects.toThrow('Missing authorization header');
    });
  });
});
