import logger from '@web/common/logger';
import { NotFoundError, DomainValidationError } from './customErrors'; 
type ErrorStatusCode = 400 | 401 | 403 | 404 | 422 | 500;

export class ErrorResponseHandler {
  static generate(error: unknown): { statusCode: ErrorStatusCode; body: { message: string } } {
    let statusCode: ErrorStatusCode = 500; 
    let message: string;

    if (error instanceof NotFoundError) {
      statusCode = 404;
      message = error.message;

    } else if (error instanceof DomainValidationError) {
      statusCode = 422;
      message = error.message;

    } else if (error instanceof Error) {
      statusCode = 400;
      message = error.message;
      
    } else {
      message = 'An unexpected error occurred';
    }

    logger.error(`[${statusCode}] Error occurred: ${message}`);

    return {
      statusCode,
      body: { message },
    };
  }
}