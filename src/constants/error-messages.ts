/**
 * Error Messages Constants
 * Centralized error messages for consistent API responses
 */

export const ErrorMessages = {
  // Authentication Errors
  AUTH: {
    INVALID_CREDENTIALS: 'Invalid NIP/NIS or password',
    ACCOUNT_INACTIVE: 'Account is inactive. Please contact administrator.',
    UNAUTHORIZED: 'Unauthorized. Please login first.',
    TOKEN_REQUIRED: 'Access token is required',
    TOKEN_EXPIRED: 'Access token expired',
    TOKEN_INVALID: 'Invalid access token',
    REFRESH_TOKEN_EXPIRED: 'Refresh token expired',
    REFRESH_TOKEN_INVALID: 'Invalid refresh token',
    REFRESH_TOKEN_REQUIRED: 'Refresh token is required',
    LOGIN_FAILED: 'Login failed',
    LOGOUT_FAILED: 'Logout failed',
    REGISTRATION_FAILED: 'Registration failed',
  },

  // Validation Errors
  VALIDATION: {
    INVALID_INPUT: 'Validation error',
    REQUIRED_FIELD: 'Field is required',
    INVALID_FORMAT: 'Invalid format',
    INVALID_LENGTH: 'Invalid length',
  },

  // Resource Errors
  RESOURCE: {
    NOT_FOUND: 'Resource not found',
    USER_NOT_FOUND: 'User not found',
    ASSIGNMENT_NOT_FOUND: 'Assignment not found',
    CLASS_NOT_FOUND: 'Class not found',
    SUBMISSION_NOT_FOUND: 'Submission not found',
    MEDIATYPE_NOT_FOUND: 'Media type not found',
    ALREADY_EXISTS: 'already exists',
    DUPLICATE_ENTRY: 'Duplicate entry',
    CANNOT_DELETE: 'Cannot delete resource',
    CANNOT_UPDATE: 'Cannot update resource',
  },

  // Server Errors
  SERVER: {
    INTERNAL_ERROR: 'Internal server error',
    DATABASE_ERROR: 'Database error',
    UNKNOWN_ERROR: 'An unexpected error occurred',
  },

  // Permission Errors
  PERMISSION: {
    FORBIDDEN: 'Forbidden: You do not have permission to access this resource',
    TEACHER_ONLY: 'Forbidden: Only teachers can perform this action',
    STUDENT_ONLY: 'Forbidden: Only students can perform this action',
    ADMIN_ONLY: 'Forbidden: Only administrators can perform this action',
  },
} as const;

/**
 * Error Status Codes
 */
export const ErrorStatusCodes = {
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  VALIDATION_ERROR: 422,
  INTERNAL_SERVER_ERROR: 500,
} as const;

