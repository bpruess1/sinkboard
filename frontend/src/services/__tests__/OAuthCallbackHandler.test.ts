/**
 * Unit tests for OAuthCallbackHandler service.
 * Tests OAuth flow logic independent of React components.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { OAuthCallbackHandler } from '../OAuthCallbackHandler';

const MOCK_CONFIG = {
  clientId: 'test-client-id',
  redirectUri: 'https://app.test.com/callback',
  tokenEndpoint: 'https://oauth.test.com/token',
};

const MOCK_TOKENS = {
  access_token: 'mock-access-token',
  id_token: 'mock-id-token',
  refresh_token: 'mock-refresh-token',
  expires_in: 3600,
};

describe('OAuthCallbackHandler', () => {
  let handler: OAuthCallbackHandler;

  beforeEach(() => {
    handler = new OAuthCallbackHandler(MOCK_CONFIG);
    vi.clearAllMocks();
  });

  describe('generateState', () => {
    it('should generate a random state string', () => {
      const state = handler.generateState();
      expect(state).toBeTruthy();
      expect(typeof state).toBe('string');
      expect(state.length).toBeGreaterThan(0);
    });

    it('should generate different states on subsequent calls', () => {
      const state1 = handler.generateState();
      const handler2 = new OAuthCallbackHandler(MOCK_CONFIG);
      const state2 = handler2.generateState();
      expect(state1).not.toBe(state2);
    });
  });

  describe('parseCallbackParams', () => {
    it('should parse authorization code from search string', () => {
      const params = handler.parseCallbackParams('?code=test-code&state=test-state');
      expect(params.code).toBe('test-code');
      expect(params.state).toBe('test-state');
    });

    it('should parse error parameters', () => {
      const params = handler.parseCallbackParams('?error=access_denied&error_description=User+denied');
      expect(params.error).toBe('access_denied');
      expect(params.error_description).toBe('User denied');
    });

    it('should handle empty search string', () => {
      const params = handler.parseCallbackParams('');
      expect(params.code).toBeUndefined();
      expect(params.state).toBeUndefined();
    });
  });

  describe('validateState', () => {
    it('should validate matching state', () => {
      const state = handler.generateState();
      expect(handler.validateState(state)).toBe(true);
    });

    it('should reject non-matching state', () => {
      handler.generateState();
      expect(handler.validateState('different-state')).toBe(false);
    });

    it('should reject undefined state', () => {
      handler.generateState();
      expect(handler.validateState(undefined)).toBe(false);
    });

    it('should reject when no pending state exists', () => {
      expect(handler.validateState('any-state')).toBe(false);
    });
  });

  describe('exchangeCodeForTokens', () => {
    beforeEach(() => {
      global.fetch = vi.fn();
    });

    it('should exchange code for tokens successfully', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => MOCK_TOKENS,
      });

      const tokens = await handler.exchangeCodeForTokens('test-code');

      expect(tokens.accessToken).toBe('mock-access-token');
      expect(tokens.idToken).toBe('mock-id-token');
      expect(tokens.refreshToken).toBe('mock-refresh-token');
      expect(tokens.expiresIn).toBe(3600);
    });

    it('should throw error on failed token exchange', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: false,
        json: async () => ({ error: 'invalid_grant' }),
      });

      await expect(handler.exchangeCodeForTokens('invalid-code')).rejects.toThrow();
    });
  });

  describe('handleCallback', () => {
    beforeEach(() => {
      global.fetch = vi.fn();
    });

    it('should handle successful OAuth callback', async () => {
      const state = handler.generateState();
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => MOCK_TOKENS,
      });

      const result = await handler.handleCallback(`?code=test-code&state=${state}`);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.tokens.accessToken).toBe('mock-access-token');
      }
    });

    it('should handle OAuth provider errors', async () => {
      const result = await handler.handleCallback('?error=access_denied&error_description=User+denied');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('access_denied');
        expect(result.errorDescription).toBe('User denied');
      }
    });

    it('should reject callback with missing code', async () => {
      const result = await handler.handleCallback('?state=test-state');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('missing_code');
      }
    });

    it('should reject callback with invalid state', async () => {
      handler.generateState();
      const result = await handler.handleCallback('?code=test-code&state=wrong-state');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('invalid_state');
      }
    });
  });
});
