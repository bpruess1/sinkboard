/**
 * Startup environment variable validation for backend Lambda functions.
 * 
 * This module validates that all required environment variables are defined
 * and well-formed before the application starts processing requests.
 * Validates AWS resource identifiers, Cognito configuration, and API settings.
 * 
 * @module config/validate-env
 * 
 * CONVENTIONS:
 * - [naming] UPPER_SNAKE_CASE for constants
 * - [error_handling] Fail fast with clear, actionable error messages
 * - [imports] AWS SDK imports first, then Node.js imports
 */

import { URL } from 'node:url';

/**
 * Required environment variables for backend Lambda functions.
 * Each variable is critical for application functionality.
 */
const REQUIRED_ENV_VARS = [
  'TABLE_NAME',
  'USER_POOL_ID',
  'USER_POOL_CLIENT_ID',
  'REGION',
] as const;

/**
 * Optional environment variables that should be validated if present.
 */
const OPTIONAL_ENV_VARS = [
  'BEDROCK_MODEL_ID',
  'CORS_ORIGIN',
] as const;

/**
 * Validates that a string is a valid AWS DynamoDB table name.
 * Table names must be 3-255 characters, alphanumeric with dashes/underscores.
 * 
 * @param tableName - The table name to validate
 * @returns true if valid table name format
 */
function isValidTableName(tableName: string): boolean {
  return /^[a-zA-Z0-9._-]{3,255}$/.test(tableName);
}

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
 * Validates that a string is a valid URL with http or https protocol.
 * 
 * @param urlString - The URL string to validate
 * @returns true if valid URL
 */
function isValidUrl(urlString: string): boolean {
  try {
    const url = new URL(urlString);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Validates all required and optional environment variables.
 * Throws detailed errors if validation fails.
 * 
 * This function should be called at Lambda initialization (outside handler)
 * to fail fast before processing any requests.
 * 
 * @throws Error with detailed message if any validation fails
 */
export function validateEnvironment(): void {
  const errors: string[] = [];

  // Check required variables are defined
  for (const varName of REQUIRED_ENV_VARS) {
    const value = process.env[varName];
    if (!value || value.trim() === '') {
      errors.push(`Missing required environment variable: ${varName}`);
    }
  }

  // If any required vars are missing, fail immediately
  if (errors.length > 0) {
    throw new Error(
      `Environment validation failed:\n${errors.join('\n')}\n\n` +
      'Ensure all required environment variables are set in Lambda configuration.'
    );
  }

  // Validate format of required variables
  const TABLE_NAME = process.env.TABLE_NAME!;
  if (!isValidTableName(TABLE_NAME)) {
    errors.push(
      `TABLE_NAME has invalid format: "${TABLE_NAME}". ` +
      'Must be 3-255 alphanumeric characters with dashes/underscores.'
    );
  }

  const USER_POOL_ID = process.env.USER_POOL_ID!;
  if (!isValidUserPoolId(USER_POOL_ID)) {
    errors.push(
      `USER_POOL_ID has invalid format: "${USER_POOL_ID}". ` +
      'Expected format: <region>_<alphanumeric> (e.g., us-east-1_aBc123DeF)'
    );
  }

  const USER_POOL_CLIENT_ID = process.env.USER_POOL_CLIENT_ID!;
  if (!isValidClientId(USER_POOL_CLIENT_ID)) {
    errors.push(
      `USER_POOL_CLIENT_ID has invalid format: "${USER_POOL_CLIENT_ID}". ` +
      'Must be 25-26 alphanumeric characters.'
    );
  }

  const REGION = process.env.REGION!;
  if (!isValidRegion(REGION)) {
    errors.push(
      `REGION has invalid format: "${REGION}". ` +
      'Expected format: <area>-<location>-<number> (e.g., us-east-1)'
    );
  }

  // Validate optional variables if present
  const CORS_ORIGIN = process.env.CORS_ORIGIN;
  if (CORS_ORIGIN && CORS_ORIGIN !== '*' && !isValidUrl(CORS_ORIGIN)) {
    errors.push(
      `CORS_ORIGIN has invalid format: "${CORS_ORIGIN}". ` +
      'Must be a valid URL or "*" for all origins.'
    );
  }

  if (errors.length > 0) {
    throw new Error(
      `Environment validation failed:\n${errors.join('\n')}\n\n` +
      'Fix configuration issues before deploying.'
    );
  }
}

// Run validation at module load time (Lambda initialization)
validateEnvironment();
