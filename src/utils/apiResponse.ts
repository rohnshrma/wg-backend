import { Response } from 'express';

interface ApiResponsePayload<T> {
  statusCode?: number;
  success?: boolean;
  message: string;
  data?: T;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    totalPages?: number;
  };
}

interface ApiResponseOptions<T> extends ApiResponsePayload<T> {
  res: Response;
}

// Overload: sendResponse({ res, statusCode, message, data })
export function sendResponse<T>(options: ApiResponseOptions<T>): void;
// Overload: sendResponse(res, { statusCode, message, data })
export function sendResponse<T>(res: Response, options: ApiResponsePayload<T>): void;
// Implementation
export function sendResponse<T>(
  resOrOptions: Response | ApiResponseOptions<T>,
  maybeOptions?: ApiResponsePayload<T>
): void {
  let res: Response;
  let statusCode: number;
  let success: boolean;
  let message: string;
  let data: T | undefined;
  let meta: ApiResponsePayload<T>['meta'];

  if (maybeOptions) {
    // Called as sendResponse(res, { ... })
    res = resOrOptions as Response;
    statusCode = maybeOptions.statusCode ?? 200;
    success = maybeOptions.success ?? true;
    message = maybeOptions.message;
    data = maybeOptions.data;
    meta = maybeOptions.meta;
  } else {
    // Called as sendResponse({ res, ... })
    const opts = resOrOptions as ApiResponseOptions<T>;
    res = opts.res;
    statusCode = opts.statusCode ?? 200;
    success = opts.success ?? true;
    message = opts.message;
    data = opts.data;
    meta = opts.meta;
  }

  const response: Record<string, unknown> = {
    success,
    message,
  };

  if (data !== undefined) {
    response.data = data;
  }

  if (meta) {
    response.meta = meta;
  }

  res.status(statusCode).json(response);
}

export const sendError = (
  res: Response,
  statusCode: number,
  message: string,
  errors?: unknown
): void => {
  const response: Record<string, unknown> = {
    success: false,
    message,
  };

  if (errors) {
    response.errors = errors;
  }

  res.status(statusCode).json(response);
};
