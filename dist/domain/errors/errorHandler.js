export const extractErrorMessage = (error) => {
    return error instanceof Error ? error.message : 'An unexpected error occurred';
};
