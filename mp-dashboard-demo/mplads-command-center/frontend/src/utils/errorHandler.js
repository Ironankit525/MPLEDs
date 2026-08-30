/**
 * Formats API or runtime errors into human-readable messages.
 */
export const handleServiceError = (error, defaultMessage = 'An unexpected error occurred.') => {
  console.error('[MPLADS Service Error]:', error);

  if (error?.response?.data?.error?.message) {
    return error.response.data.error.message;
  }

  if (error?.message) {
    return error.message;
  }

  return defaultMessage;
};
