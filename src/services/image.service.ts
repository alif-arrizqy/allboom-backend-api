import sharp from 'sharp';
import logger from '../utils/logger';
import {
  MIN_IMAGE_WIDTH,
  MIN_IMAGE_HEIGHT,
  MAX_IMAGE_WIDTH,
  MAX_IMAGE_HEIGHT,
} from '../utils/file';

export interface ImageMetadata {
  width: number;
  height: number;
  format: string;
  size: number;
}

export interface ProcessedImage {
  full: Buffer;
  medium?: Buffer;
  thumbnail?: Buffer;
  metadata: ImageMetadata;
}

export class ImageService {
  async validateImage(buffer: Buffer): Promise<{ valid: boolean; error?: string; metadata?: ImageMetadata }> {
    try {
      const metadata = await sharp(buffer).metadata();

      if (!metadata.width || !metadata.height) {
        return { valid: false, error: 'Invalid image: unable to read dimensions' };
      }

      if (metadata.width < MIN_IMAGE_WIDTH || metadata.height < MIN_IMAGE_HEIGHT) {
        return {
          valid: false,
          error: `Image dimensions too small. Minimum: ${MIN_IMAGE_WIDTH}x${MIN_IMAGE_HEIGHT}px`,
        };
      }

      if (metadata.width > MAX_IMAGE_WIDTH || metadata.height > MAX_IMAGE_HEIGHT) {
        return {
          valid: false,
          error: `Image dimensions too large. Maximum: ${MAX_IMAGE_WIDTH}x${MAX_IMAGE_HEIGHT}px`,
        };
      }

      return {
        valid: true,
        metadata: {
          width: metadata.width,
          height: metadata.height,
          format: metadata.format || 'unknown',
          size: buffer.length,
        },
      };
    } catch (error) {
      logger.error({ error }, 'Image validation error');
      return { valid: false, error: 'Invalid image file' };
    }
  }

  async processImage(buffer: Buffer, generateThumbnails = true): Promise<ProcessedImage> {
    try {
      const metadata = await sharp(buffer).metadata();

      // Full size image (optimized)
      const full = await sharp(buffer)
        .resize(MAX_IMAGE_WIDTH, MAX_IMAGE_HEIGHT, {
          fit: 'inside',
          withoutEnlargement: true,
        })
        .jpeg({ quality: 90 })
        .toBuffer();

      let medium: Buffer | undefined;
      let thumbnail: Buffer | undefined;

      if (generateThumbnails) {
        // Medium size (800x600)
        medium = await sharp(buffer)
          .resize(800, 600, {
            fit: 'inside',
            withoutEnlargement: true,
          })
          .jpeg({ quality: 85 })
          .toBuffer();

        // Thumbnail (300x300)
        thumbnail = await sharp(buffer)
          .resize(300, 300, {
            fit: 'cover',
            position: 'center',
          })
          .jpeg({ quality: 80 })
          .toBuffer();
      }

      return {
        full,
        medium,
        thumbnail,
        metadata: {
          width: metadata.width || 0,
          height: metadata.height || 0,
          format: metadata.format || 'jpeg',
          size: full.length,
        },
      };
    } catch (error) {
      logger.error({ error }, 'Image processing error');
      throw new Error('Failed to process image');
    }
  }

  async processAvatar(buffer: Buffer): Promise<ProcessedImage> {
    try {
      const metadata = await sharp(buffer).metadata();

      const full = await sharp(buffer)
        .resize(400, 400, {
          fit: 'cover',
          position: 'center',
        })
        .jpeg({ quality: 85 })
        .toBuffer();

      return {
        full,
        metadata: {
          width: metadata.width || 0,
          height: metadata.height || 0,
          format: 'jpeg',
          size: full.length,
        },
      };
    } catch (error) {
      logger.error({ error }, 'Avatar processing error');
      throw new Error('Failed to process avatar');
    }
  }

  async resizeImage(buffer: Buffer, width: number, height: number, quality = 90): Promise<Buffer> {
    try {
      return await sharp(buffer)
        .resize(width, height, {
          fit: 'inside',
          withoutEnlargement: true,
        })
        .jpeg({ quality })
        .toBuffer();
    } catch (error) {
      logger.error({ error }, 'Image resize error');
      throw new Error('Failed to resize image');
    }
  }
}

export default new ImageService();

