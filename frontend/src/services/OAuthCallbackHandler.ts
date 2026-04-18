/**
 * OAuthCallbackHandler Service
 * 
 * Handles OAuth redirect processing and token management independently of React components.
 * This service extracts OAuth flow logic from UI components, making it testable and reusable.
 * 
 * Responsibilities:
 * - Parse OAuth callback URLs and extract authorization codes
 * - Exchange authorization codes for access tokens
 * - Validate OAuth state parameters to prevent CSRF attacks
 * - Handle OAuth errors from the provider
 * - Store tokens securely after successful authentication
 * 
 * @example
 * const handler = new OAuthCallbackHandler({
 *   clientId: 'your-client-id',
 *   redirectUri: 'https://app.example.com/callback'
 * });
 * 
 * const result = await handler.handleCallback(window.location.search);
 * if (result.success) {
 *   // Use result.tokens
 * }
 */

interface OAuthConfig {
  clientId: string;
  redirectUri: string;
  tokenEndpoint: string;
  scope?: string;
}

interface OAuthTokens {
  accessToken: string;
  idToken: string;
  refreshToken?: string;
  expiresIn: number;
}

interface OAuthCallbackSuccess {
  success: true;
  tokens: OAuthTokens;
}

interface OAuthCallbackError {
  success: false;
  error: string;
  errorDescription?: string;
}

type OAuthCallbackResult = OAuthCallbackSuccess | OAuthCallbackError;

interface OAuthCallbackParams {
  code?: string;
  state?: string;
  error?: string;
  error_description?: string;
}

/**
 * Service class for handling OAuth 2.0 authorization code flow callbacks.
 * Decoupled from React components to enable unit testing and reuse.
 */
export class OAuthCallbackHandler {
  private config: OAuthConfig;
  private pendingState: string | null = null;

  constructor(config: OAuthConfig) {
    this.config = config;
  }

  /**
   * Generate a cryptographically secure random state parameter for CSRF protection.
   * State should be stored and validated when the OAuth callback is processed.
   * 
   * @returns A random state string suitable for OAuth flows
   */
  generateState(): string {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    const state = Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
    this.pendingState = state;
    return state;
  }

  /**
   * Parse OAuth callback parameters from URL search string.
   * Extracts code, state, and error parameters from the query string.
   * 
   * @param searchString - URL search string (e.g., window.location.search)
   * @returns Parsed OAuth callback parameters
   */
  parseCallbackParams(searchString: string): OAuthCallbackParams {
    const params = new URLSearchParams(searchString);
    return {
      code: params.get('code') || undefined,
      state: params.get('state') || undefined,
      error: params.get('error') || undefined,
      error_description: params.get('error_description') || undefined,
    };
  }

  /**
   * Validate the state parameter to prevent CSRF attacks.
   * Compares received state with the expected pending state.
   * 
   * @param receivedState - State parameter from OAuth callback
   * @returns True if state is valid, false otherwise
   */
  validateState(receivedState: string | undefined): boolean {
    if (!receivedState || !this.pendingState) {
      return false;
    }
    return receivedState === this.pendingState;
  }

  /**
   * Exchange authorization code for access tokens.
   * Makes a POST request to the OAuth provider's token endpoint.
   * 
   * @param code - Authorization code from OAuth callback
   * @returns OAuth tokens (access token, ID token, etc.)
   * @throws Error if token exchange fails
   */
  async exchangeCodeForTokens(code: string): Promise<OAuthTokens> {
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
    });

    const response = await fetch(this.config.tokenEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.error_description || errorData.error || 'Token exchange failed'
      );
    }

    const data = await response.json();
    return {
      accessToken: data.access_token,
      idToken: data.id_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expires_in || 3600,
    };
  }

  /**
   * Handle OAuth callback from provider.
   * Orchestrates the complete callback flow: parsing, validation, and token exchange.
   * 
   * @param searchString - URL search string containing OAuth callback parameters
   * @returns Result indicating success with tokens or failure with error
   */
  async handleCallback(searchString: string): Promise<OAuthCallbackResult> {
    const params = this.parseCallbackParams(searchString);

    // Check for OAuth provider errors
    if (params.error) {
      return {
        success: false,
        error: params.error,
        errorDescription: params.error_description,
      };
    }

    // Validate required parameters
    if (!params.code) {
      return {
        success: false,
        error: 'missing_code',
        errorDescription: 'Authorization code not found in callback',
      };
    }

    // Validate state to prevent CSRF
    if (!this.validateState(params.state)) {
      return {
        success: false,
        error: 'invalid_state',
        errorDescription: 'State parameter validation failed',
      };
    }

    // Exchange code for tokens
    try {
      const tokens = await this.exchangeCodeForTokens(params.code);
      this.pendingState = null; // Clear state after successful exchange
      return {
        success: true,
        tokens,
      };
    } catch (error) {
      return {
        success: false,
        error: 'token_exchange_failed',
        errorDescription: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}
