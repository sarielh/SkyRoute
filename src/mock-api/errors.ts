import type { ApiErrorBody, ApiErrorDetail } from '../shared';
import type { ZodType, ZodTypeDef } from 'zod';

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: ApiErrorDetail[],
  ) {
    super(message);
  }
}

export function validationError(details: ApiErrorDetail[] | Record<string, string>, message = 'Some fields are invalid.'): ApiError {
  const list = Array.isArray(details)
    ? details
    : Object.entries(details).map(([field, msg]) => ({ field, message: msg }));
  return new ApiError(400, 'VALIDATION_ERROR', message, list);
}

export function notFound(message: string, code = 'NOT_FOUND'): ApiError {
  return new ApiError(404, code, message);
}

export function conflict(code: string, message: string, details?: ApiErrorDetail[]): ApiError {
  return new ApiError(409, code, message, details);
}

export function errorBody(err: unknown, requestId: string): { status: number; body: ApiErrorBody } {
  if (err instanceof ApiError) {
    return {
      status: err.status,
      body: { error: { code: err.code, message: err.message, ...(err.details ? { details: err.details } : {}) }, requestId },
    };
  }
  console.error(`[${requestId}]`, err);
  return { status: 500, body: { error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred. Please try again.' }, requestId } };
}

/** Parses a request body, converting schema issues into a structured 400 response. */
export function parseBody<T>(schema: ZodType<T, ZodTypeDef, unknown>, body: unknown): T {
  const result = schema.safeParse(body ?? {});
  if (result.success) return result.data;
  const details = result.error.issues.map((issue) => {
    const field = issue.path.join('.') || 'body';
    const missing = issue.code === 'invalid_type' && issue.received === 'undefined';
    return { field, message: missing ? `${field} is required.` : issue.message };
  });
  throw validationError(details, 'The request body is invalid.');
}
