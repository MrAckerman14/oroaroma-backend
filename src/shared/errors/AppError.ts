export class AppError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(message: string, options: { statusCode: number; code: string; details?: unknown }) {
    super(message);
    this.name = 'AppError';
    this.statusCode = options.statusCode;
    this.code = options.code;
    this.details = options.details;
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'No autenticado') {
    super(message, { statusCode: 401, code: 'UNAUTHORIZED' });
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'No tienes permisos para realizar esta accion') {
    super(message, { statusCode: 403, code: 'FORBIDDEN' });
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Recurso no encontrado') {
    super(message, { statusCode: 404, code: 'NOT_FOUND' });
  }
}

export class ValidationAppError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, { statusCode: 422, code: 'VALIDATION_ERROR', details });
  }
}

export class ConflictError extends AppError {
  constructor(message = 'El recurso ya existe', details?: unknown) {
    super(message, { statusCode: 409, code: 'CONFLICT', details });
  }
}
