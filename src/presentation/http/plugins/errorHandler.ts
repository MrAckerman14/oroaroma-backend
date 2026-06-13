import type { FastifyInstance } from 'fastify';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';
import {
  AppError,
  ConflictError,
  NotFoundError,
  ValidationAppError
} from '../../../shared/errors/AppError.js';

export function registerErrorHandler(app: FastifyInstance) {
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ZodError) {
      const validationError = new ValidationAppError('Datos invalidos', zodDetailsInSpanish(error));
      return reply.status(validationError.statusCode).send({
        code: validationError.code,
        codeLabel: errorCodeLabel(validationError.code),
        message: validationError.message,
        details: validationError.details,
        requestId: request.id
      });
    }

    const prismaError = toPrismaAppError(error);
    if (prismaError) {
      app.log.warn({ prisma: prismaLogDetails(error), requestId: request.id }, 'Error de base de datos manejado');
      return reply.status(prismaError.statusCode).send({
        code: prismaError.code,
        codeLabel: errorCodeLabel(prismaError.code),
        message: prismaError.message,
        details: prismaError.details,
        requestId: request.id
      });
    }

    if (error instanceof AppError) {
      return reply.status(error.statusCode).send({
        code: error.code,
        codeLabel: errorCodeLabel(error.code),
        message: error.message,
        details: error.details,
        requestId: request.id
      });
    }

    const statusCode = statusCodeFromError(error);
    if (statusCode && statusCode >= 400 && statusCode < 500) {
      const message = statusCode === 413 ? 'El archivo o la solicitud excede el limite permitido' : 'Solicitud invalida';
      return reply.status(statusCode).send({
        code: statusCode === 413 ? 'PAYLOAD_TOO_LARGE' : 'BAD_REQUEST',
        codeLabel: statusCode === 413 ? 'Solicitud demasiado grande' : 'Solicitud invalida',
        message,
        requestId: request.id
      });
    }

    app.log.error({ err: error, requestId: request.id }, 'Error no controlado de la API');
    return reply.status(500).send({
      code: 'INTERNAL_SERVER_ERROR',
      codeLabel: 'Error interno del servidor',
      message: 'Error interno',
      requestId: request.id
    });
  });
}

function toPrismaAppError(error: unknown): AppError | undefined {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') {
      return new ConflictError(duplicateMessage(error.meta?.target), {
        campos: error.meta?.target
      });
    }

    if (error.code === 'P2003') {
      return new ValidationAppError('La relacion indicada no existe o no se puede modificar');
    }

    if (error.code === 'P2025') {
      return new NotFoundError('Recurso no encontrado');
    }

    if (error.code === 'P2023') {
      return new ValidationAppError('Identificador invalido');
    }

    if (error.code === 'P2034') {
      return new ConflictError('Operacion concurrente detectada. Intenta nuevamente.');
    }
  }

  if (error instanceof Prisma.PrismaClientValidationError) {
    return new ValidationAppError('Datos invalidos');
  }

  return undefined;
}

function prismaLogDetails(error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return {
      codigo: error.code,
      modelo: typeof error.meta?.modelName === 'string' ? error.meta.modelName : undefined,
      campos: error.meta?.target
    };
  }

  if (error instanceof Prisma.PrismaClientValidationError) {
    return { codigo: 'VALIDATION_ERROR' };
  }

  return { codigo: 'UNKNOWN' };
}

function duplicateMessage(target: unknown) {
  const fields = Array.isArray(target) ? target : [];
  if (fields.includes('email')) return 'Ya existe un usuario con ese correo';
  return 'Ya existe un registro con esos datos';
}

function zodDetailsInSpanish(error: ZodError) {
  const erroresPorCampo: Record<string, string[]> = {};
  const erroresGenerales: string[] = [];

  for (const issue of error.issues) {
    const message = spanishZodIssueMessage(issue);
    const path = issue.path.join('.');
    if (!path) {
      erroresGenerales.push(message);
      continue;
    }

    erroresPorCampo[path] = [...(erroresPorCampo[path] ?? []), message];
  }

  return { erroresPorCampo, erroresGenerales };
}

function spanishZodIssueMessage(issue: ZodError['issues'][number]) {
  if (issue.code === 'invalid_type') return 'Tipo de dato invalido';
  if (issue.code === 'invalid_format') return 'Formato invalido';
  if (issue.code === 'too_small') return 'El valor es demasiado corto o pequeno';
  if (issue.code === 'too_big') return 'El valor es demasiado largo o grande';
  if (issue.code === 'invalid_value') return 'Valor invalido';
  if (issue.code === 'custom') return 'Valor invalido';
  return 'Dato invalido';
}

function statusCodeFromError(error: unknown) {
  if (!error || typeof error !== 'object') return undefined;
  const statusCode = (error as { statusCode?: unknown }).statusCode;
  return typeof statusCode === 'number' ? statusCode : undefined;
}

function errorCodeLabel(code: string) {
  const labels: Record<string, string> = {
    UNAUTHORIZED: 'No autenticado',
    FORBIDDEN: 'Sin permiso',
    NOT_FOUND: 'No encontrado',
    VALIDATION_ERROR: 'Error de validacion',
    CONFLICT: 'Conflicto',
    INTERNAL_SERVER_ERROR: 'Error interno del servidor'
  };

  return labels[code] ?? 'Error';
}
