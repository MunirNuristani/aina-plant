export abstract class AppError extends Error {
  abstract readonly code: string;

  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class ValidationError extends AppError {
  readonly code = 'VALIDATION_ERROR';

  constructor(message: string, details?: unknown) {
    super(message, 400, details);
  }
}

export class NotFoundError extends AppError {
  readonly code = 'NOT_FOUND';

  constructor(message: string) {
    super(message, 404);
  }
}

export class ConflictError extends AppError {
  readonly code = 'CONFLICT';

  constructor(message: string, details?: unknown) {
    super(message, 409, details);
  }
}

export class UnauthorizedError extends AppError {
  readonly code = 'UNAUTHORIZED';

  constructor(message: string) {
    super(message, 401);
  }
}

export class ForbiddenError extends AppError {
  readonly code = 'FORBIDDEN';

  constructor(message: string) {
    super(message, 403);
  }
}

export class TooManyRequestsError extends AppError {
  readonly code = 'TOO_MANY_REQUESTS';

  constructor(message: string) {
    super(message, 429);
  }
}

export type FieldError = { field: string; message: string };

/**
 * Maps validation-library issues (e.g. Zod's) to a stable, minimal public
 * shape. Only relies on `path` + `message`, which are the most likely to
 * survive a validation-library version change — decoupling the API's
 * error contract from a specific library's internal issue format (zod's
 * own issue shape has already changed once across a major version in this
 * project).
 */
export function toFieldErrors(
  issues: ReadonlyArray<{ path: PropertyKey[]; message: string }>,
): FieldError[] {
  return issues.map((issue) => ({
    field: issue.path.length > 0 ? issue.path.join('.') : '(root)',
    message: issue.message,
  }));
}
