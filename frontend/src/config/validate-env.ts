/**
 * Startup environment variable validation for frontend application.
 * 
 * This module validates that all required Vite environment variables are defined
 * and well-formed before the React application renders. Validates Cognito configuration,
 * API endpoints, and feature flags.
 * 
 * @module config/validate-env
 * 
 * CONVENTIONS:
 * - [naming] UPPER_SNAKE_CASE for constants
 * - [error_handling] Fail fast with clear, actionable error messages
 * - [imports] Browser APIs, then type imports
 */

/**
 * Required Vite environment variables for frontend application.
 * All variables must be prefixed with VITE_ to be exposed to the browser.
 */
const REQUIRED_ENV_VARS = [
  'VITE_COGNITO_USER_POOL_ID',
  'VITE_COGNITO_CLIENT_ID',
  'VITE_COGNITO_REGION',
  'VITE_API_URL',
] as const;

/**
 * Validates that a string is a valid AWS Cognito User Pool ID.
 * Format: <region>_<alphanumeric>
 * 
 * @param userPoolId - The user pool ID to validate
 * @returns true if valid user pool ID format
 */
function isValidUserPoolId(userPoolId: string): boolean {
  return /^[a-z]+-[a-z]+-[0-9]+_[a-zA-Z0-9]+$/.test(userPoolId);
}

/**
 * Validates that a string is a valid AWS Cognito Client ID.
 * Client IDs are 26-character alphanumeric strings.
 * 
 * @param clientId - The client ID to validate
 * @returns true if valid client ID format
 */
function isValidClientId(clientId: string): boolean {
  return /^[a-z0-9]{25,26}$/i.test(clientId);
}

/**
 * Validates that a string is a valid AWS region identifier.
 * 
 * @param region - The region to validate
 * @returns true if valid region format
 */
function isValidRegion(region: string): boolean {
  return /^[a-z]{2}-[a-z]+-[0-9]{1}$/.test(region);
}

/**
 * Validates that a string is a valid HTTPS URL.
 * Frontend API endpoints should always use HTTPS in production.
 * 
 * @param urlString - The URL string to validate
 * @param allowHttp - Allow http:// protocol (for local development)
 * @returns true if valid URL
 */
function isValidApiUrl(urlString: string, allowHttp = false): boolean {
  try {
    const url = new URL(urlString);
    if (allowHttp) {
      return url.protocol === 'http:' || url.protocol === 'https:';
    }
    return url.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Validates all required Vite environment variables.
 * Throws detailed errors if validation fails.
 * 
 * This function should be called at application startup (in main.tsx)
 * to fail fast before React renders.
 * 
 * @throws Error with detailed message if any validation fails
 */
export function validateEnvironment(): void {
  const errors: string[] = [];
  const isLocalDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

  // Check required variables are defined
  for (const varName of REQUIRED_ENV_VARS) {
    const value = import.meta.env[varName];
    if (!value || (typeof value === 'string' && value.trim() === '')) {
      errors.push(`Missing required environment variable: ${varName}`);
    }
  }

  // If any required vars are missing, fail immediately
  if (errors.length > 0) {
    throw new Error(
      `Environment validation failed:\n${errors.join('\n')}\n\n` +
      'Ensure all required environment variables are set in .env file or build configuration.\n' +
      'See .env.example for required variables.'
    );
  }

  // Validate format of required variables
  const VITE_COGNITO_USER_POOL_ID = import.meta.env.VITE_COGNITO_USER_POOL_ID as string;
  if (!isValidUserPoolId(VITE_COGNITO_USER_POOL_ID)) {
    errors.push(
      `VITE_COGNITO_USER_POOL_ID has invalid format: "${VITE_COGNITO_USER_POOL_ID}". ` +
      'Expected format: <region>_<alphanumeric> (e.g., us-east-1_aBc123DeF)'
    );
  }

  const VITE_COGNITO_CLIENT_ID = import.meta.env.VITE_COGNITO_CLIENT_ID as string;
  if (!isValidClientId(VITE_COGNITO_CLIENT_ID)) {
    errors.push(
      `VITE_COGNITO_CLIENT_ID has invalid format: "${VITE_COGNITO_CLIENT_ID}". ` +
      'Must be 25-26 alphanumeric characters.'
    );
  }

  const VITE_COGNITO_REGION = import.meta.env.VITE_COGNITO_REGION as string;
  if (!isValidRegion(VITE_COGNITO_REGION)) {
    errors.push(
      `VITE_COGNITO_REGION has invalid format: "${VITE_COGNITO_REGION}". ` +
      'Expected format: <area>-<location>-<number> (e.g., us-east-1)'
    );
  }

  const VITE_API_URL = import.meta.env.VITE_API_URL as string;
  if (!isValidApiUrl(VITE_API_URL, isLocalDev)) {
    if (isLocalDev) {
      errors.push(
        `VITE_API_URL has invalid format: "${VITE_API_URL}". ` +
        'Must be a valid HTTP or HTTPS URL.'
      );
    } else {
      errors.push(
        `VITE_API_URL has invalid format: "${VITE_API_URL}". ` +
        'Must be a valid HTTPS URL (HTTP not allowed in production).'
      );
    }
  }

  if (errors.length > 0) {
    throw new Error(
      `Environment validation failed:\n${errors.join('\n')}\n\n` +
      'Fix configuration issues before building or running the application.'
    );
  }
}
