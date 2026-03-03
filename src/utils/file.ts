import { Readable } from 'stream';
import env from '../config/env';

export interface FileValidationResult {
  valid: boolean;
  error?: string;
}

export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

export const ALLOWED_DOCUMENT_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
];

export const ALLOWED_DOCUMENT_EXTENSIONS = ['.pdf', '.doc', '.docx', '.ppt', '.pptx'];

export const MAX_DOCUMENT_SIZE = 20 * 1024 * 1024; // 20MB for documents

export function validateDocumentType(mimetype: string): FileValidationResult {
  if (!ALLOWED_DOCUMENT_TYPES.includes(mimetype)) {
    return {
      valid: false,
      error: `Tipe file tidak diizinkan. Tipe yang diizinkan: PDF, DOC, DOCX, PPT, PPTX`,
    };
  }
  return { valid: true };
}

export function validateDocumentSize(size: number): FileValidationResult {
  if (size > MAX_DOCUMENT_SIZE) {
    return {
      valid: false,
      error: `Ukuran file melebihi batas maksimal ${MAX_DOCUMENT_SIZE / 1024 / 1024}MB`,
    };
  }
  return { valid: true };
}

// File size limit from environment (in bytes)
export const MAX_FILE_SIZE = env.MAX_FILE_SIZE;

// Image dimension limits from environment
export const MIN_IMAGE_WIDTH = env.IMAGE_MIN_WIDTH;
export const MIN_IMAGE_HEIGHT = env.IMAGE_MIN_HEIGHT;
export const MAX_IMAGE_WIDTH = env.IMAGE_MAX_WIDTH;
export const MAX_IMAGE_HEIGHT = env.IMAGE_MAX_HEIGHT;

export function validateFileType(mimetype: string): FileValidationResult {
  if (!ALLOWED_IMAGE_TYPES.includes(mimetype)) {
    return {
      valid: false,
      error: `File type not allowed. Allowed types: ${ALLOWED_IMAGE_TYPES.join(', ')}`,
    };
  }
  return { valid: true };
}

export function validateFileSize(size: number): FileValidationResult {
  if (size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `File size exceeds maximum allowed size of ${MAX_FILE_SIZE / 1024 / 1024}MB`,
    };
  }
  return { valid: true };
}

export function getFileExtension(filename: string): string {
  return filename.split('.').pop()?.toLowerCase() || '';
}

export function generateFileName(originalName: string, prefix?: string): string {
  const ext = getFileExtension(originalName);
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 15);
  const name = prefix ? `${prefix}-${timestamp}-${random}.${ext}` : `${timestamp}-${random}.${ext}`;
  return name;
}

export function bufferToStream(buffer: Buffer): Readable {
  return Readable.from(buffer);
}

