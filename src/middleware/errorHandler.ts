import { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { ApiError } from '../utils/apiError';
import env from '../config/env';

const multerErrorMessages: Record<string, string> = {
  LIMIT_FILE_SIZE: 'File is too large. Maximum size is 5MB.',
  LIMIT_UNEXPECTED_FILE: 'Unexpected file field.',
};

const errorHandler = (
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  let statusCode = 500;
  let message = 'Internal Server Error';
  let errors: unknown = undefined;

  // Custom API Error
  if (err instanceof ApiError) {
    statusCode = err.statusCode;
    message = err.message;
    if ('errors' in err) {
      errors = (err as any).errors;
    }
  }

  // Multer upload errors (file too large, unexpected field, etc.)
  if (err instanceof multer.MulterError) {
    statusCode = 400;
    message = multerErrorMessages[err.code] || err.message;
  }

  // Mongoose Validation Error
  if (err.name === 'ValidationError') {
    statusCode = 422;
    message = 'Validation Error';
    const mongooseErr = err as any;
    errors = Object.keys(mongooseErr.errors).map((key) => ({
      field: key,
      message: mongooseErr.errors[key].message,
    }));
  }

  // Mongoose Duplicate Key Error
  if ((err as any).code === 11000) {
    statusCode = 409;
    const field = Object.keys((err as any).keyValue)[0];
    message = `${field} already exists`;
  }

  // Mongoose Cast Error (invalid ObjectId)
  if (err.name === 'CastError') {
    statusCode = 400;
    message = 'Invalid ID format';
  }

  // JWT Errors
  if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid token';
  }

  if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Token expired';
  }

  // Log error in development
  if (env.NODE_ENV === 'development') {
    console.error('❌ Error:', err);
  }

  const response: Record<string, unknown> = {
    success: false,
    message,
  };

  if (errors) {
    response.errors = errors;
  }

  if (env.NODE_ENV === 'development') {
    response.stack = err.stack;
  }

  res.status(statusCode).json(response);
};

export default errorHandler;
