import logger from '../../common/logger.js';
import { NotFoundError, DomainValidationError } from './customErrors.js';
export class ErrorResponseHandler {
    static generate(error) {
        let statusCode = 500;
        let message;
        if (error instanceof NotFoundError) {
            statusCode = 404;
            message = error.message;
        }
        else if (error instanceof DomainValidationError) {
            statusCode = 422;
            message = error.message;
        }
        else if (error instanceof Error) {
            statusCode = 400;
            message = error.message;
        }
        else {
            message = 'An unexpected error occurred';
        }
        logger.error(`[${statusCode}] Error occurred: ${message}`);
        return {
            statusCode,
            body: { message },
        };
    }
}
