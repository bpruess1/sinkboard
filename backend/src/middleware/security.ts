import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';

// --------------- Security Constants ---------------

const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 100;
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS?.split(',') || [];

// In-memory rate limiting (for single Lambda instance)
// For production, use DynamoDB or ElastiCache
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

// --------------- Security Headers ---------------

export const SECURITY_HEADERS = {
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Content-Security-Policy': "default-src 'self'; script-src 'self'; object-src 'none'",
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
} as const;

// --------------- CORS Validation ---------------

export function validateOrigin(origin: string | undefined): boolean {
  if (!origin) return false;
  
  // In development, allow localhost
  if (process.env.NODE_ENV === 'development') {
    if (origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:')) {
      return true;
    }
  }
  
  return ALLOWED_ORIGINS.includes(origin);
}

export function getCorsHeaders(origin: string | undefined): Record<string, string> {
  const isValidOrigin = validateOrigin(origin);
  
  if (!isValidOrigin) {
    return {};
  }
  
  return {
    'Access-Control-Allow-Origin': origin!,
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Request-ID',
    'Access-Control-Max-Age': '86400',
    'Access-Control-Allow-Credentials': 'true',
  };
}

// --------------- Rate Limiting ---------------

export function checkRateLimit(identifier: string): { allowed: boolean; retryAfter?: number } {
  const now = Date.now();
  const record = rateLimitStore.get(identifier);
  
  // Clean up expired entries periodically
  if (rateLimitStore.size > 10000) {
    for (const [key, value] of rateLimitStore.entries()) {
      if (value.resetAt < now) {
        rateLimitStore.delete(key);
      }
    }
  }
  
  if (!record || record.resetAt < now) {
    // Start new window
    rateLimitStore.set(identifier, {
      count: 1,
      resetAt: now + RATE_LIMIT_WINDOW_MS,
    });
    return { allowed: true };
  }
  
  if (record.count >= MAX_REQUESTS_PER_WINDOW) {
    const retryAfter = Math.ceil((record.resetAt - now) / 1000);
    return { allowed: false, retryAfter };
  }
  
  // Increment counter
  record.count++;
  return { allowed: true };
}

export function getRateLimitIdentifier(event: APIGatewayProxyEventV2): string {
  // Use IP address + user agent for anonymous requests
  // Use user ID for authenticated requests (requires auth middleware to run first)
  const ip = event.requestContext.http.sourceIp;
  const userAgent = event.headers['user-agent'] || 'unknown';
  return `${ip}:${userAgent.slice(0, 50)}`;
}

// --------------- Input Sanitization ---------------

export function sanitizeString(input: string, maxLength: number = 10000): string {
  // Normalize unicode, trim whitespace
  let sanitized = input.normalize('NFC').trim();
  
  // Truncate to max length
  if (sanitized.length > maxLength) {
    sanitized = sanitized.slice(0, maxLength);
  }
  
  // Remove null bytes (PostgreSQL/DynamoDB injection prevention)
  sanitized = sanitized.replace(/\0/g, '');
  
  return sanitized;
}

// --------------- Security Middleware ---------------

export function withSecurityHeaders(
  handler: (event: APIGatewayProxyEventV2) => Promise<APIGatewayProxyResultV2>
): (event: APIGatewayProxyEventV2) => Promise<APIGatewayProxyResultV2> {
  return async (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> => {
    // Handle preflight OPTIONS requests
    if (event.requestContext.http.method === 'OPTIONS') {
      const origin = event.headers.origin;
      return {
        statusCode: 204,
        headers: {
          ...SECURITY_HEADERS,
          ...getCorsHeaders(origin),
        },
        body: '',
      };
    }
    
    // Validate origin for all requests
    const origin = event.headers.origin;
    if (origin && !validateOrigin(origin)) {
      return {
        statusCode: 403,
        headers: SECURITY_HEADERS,
        body: JSON.stringify({ error: 'Origin not allowed' }),
      };
    }
    
    // Rate limiting
    const identifier = getRateLimitIdentifier(event);
    const rateLimitCheck = checkRateLimit(identifier);
    
    if (!rateLimitCheck.allowed) {
      return {
        statusCode: 429,
        headers: {
          ...SECURITY_HEADERS,
          ...getCorsHeaders(origin),
          'Retry-After': String(rateLimitCheck.retryAfter),
          'X-RateLimit-Limit': String(MAX_REQUESTS_PER_WINDOW),
          'X-RateLimit-Remaining': '0',
        },
        body: JSON.stringify({
          error: 'Too many requests',
          retryAfter: rateLimitCheck.retryAfter,
        }),
      };
    }
    
    // Execute handler
    const result = await handler(event);
    
    // Add security headers to response
    return {
      ...result,
      headers: {
        ...SECURITY_HEADERS,
        ...getCorsHeaders(origin),
        ...result.headers,
      },
    };
  };
}
