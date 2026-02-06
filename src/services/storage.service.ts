import supabaseClient from '../config/supabase';
import logger from '../utils/logger';
import { Readable } from 'stream';

export class StorageService {
  private async streamToBuffer(stream: Readable): Promise<Buffer> {
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }

  private getPublicUrl(bucket: string, objectName: string): string {
    const { data } = supabaseClient.storage.from(bucket).getPublicUrl(objectName);
    return data.publicUrl;
  }

  async uploadFile(
    bucket: string,
    objectName: string,
    file: Buffer | Readable,
    contentType: string
  ): Promise<string> {
    try {
      let fileBuffer: Buffer;
      if (Buffer.isBuffer(file)) {
        fileBuffer = file;
      } else {
        fileBuffer = await this.streamToBuffer(file);
      }

      const { error } = await supabaseClient.storage.from(bucket).upload(objectName, fileBuffer, {
        contentType,
        upsert: true, // Overwrite if exists
      });

      if (error) {
        logger.error({ error, bucket, objectName }, 'Failed to upload file to Supabase Storage');
        throw new Error(`Failed to upload file: ${error.message}`);
      }

      const url = this.getPublicUrl(bucket, objectName);
      logger.info({ bucket, objectName, url }, 'File uploaded successfully');
      return url;
    } catch (error: any) {
      logger.error({ error, bucket, objectName }, 'Failed to upload file');
      throw new Error(error.message || 'Failed to upload file');
    }
  }

  async deleteFile(bucket: string, objectName: string): Promise<void> {
    try {
      const { error } = await supabaseClient.storage.from(bucket).remove([objectName]);

      if (error) {
        logger.error({ error, bucket, objectName }, 'Failed to delete file from Supabase Storage');
        throw new Error(`Failed to delete file: ${error.message}`);
      }

      logger.info({ bucket, objectName }, 'File deleted successfully');
    } catch (error: any) {
      logger.error({ error, bucket, objectName }, 'Failed to delete file');
      throw new Error(error.message || 'Failed to delete file');
    }
  }

  async getFileUrl(bucket: string, objectName: string): Promise<string> {
    return this.getPublicUrl(bucket, objectName);
  }

  async getPresignedUrl(bucket: string, objectName: string, expiry = 3600): Promise<string> {
    try {
      const { data, error } = await supabaseClient.storage
        .from(bucket)
        .createSignedUrl(objectName, expiry);

      if (error) {
        logger.error({ error, bucket, objectName }, 'Failed to generate presigned URL');
        throw new Error(`Failed to generate presigned URL: ${error.message}`);
      }

      return data.signedUrl;
    } catch (error: any) {
      logger.error({ error, bucket, objectName }, 'Failed to generate presigned URL');
      throw new Error(error.message || 'Failed to generate presigned URL');
    }
  }

  async downloadFile(bucket: string, objectNameOrUrl: string): Promise<Buffer> {
    try {
      // If a full public URL is provided, try to extract object name
      let objectName = objectNameOrUrl;
      try {
        const url = new URL(objectNameOrUrl);
        // Expected Supabase public URL: /storage/v1/object/public/{bucket}/{objectName}
        const parts = url.pathname.split('/');
        const idx = parts.indexOf('object');
        if (idx >= 0 && parts[idx + 1] === 'public') {
          // next is bucket, then object path
          const possibleBucket = parts[idx + 2];
          if (possibleBucket === bucket) {
            objectName = parts.slice(idx + 3).join('/');
          }
        }
      } catch (err) {
        // ignore URL parse errors and treat as objectName
      }

      const { data, error } = await (await import('../config/supabase')).default.storage.from(bucket).download(objectName);
      if (error || !data) {
        throw new Error(error?.message || 'Failed to download file');
      }

      // data is a ReadableStream or Blob depending on environment; convert to Buffer
      const anyData: any = data;
      if (anyData && typeof anyData.arrayBuffer === 'function') {
        const ab = await anyData.arrayBuffer();
        return Buffer.from(ab);
      }

      // Node: data is a stream
      const stream = anyData as NodeJS.ReadableStream;
      const buffers: Buffer[] = [];
      return await new Promise<Buffer>((resolve, reject) => {
        stream.on('data', (chunk: any) => buffers.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
        stream.on('end', () => resolve(Buffer.concat(buffers)));
        stream.on('error', (err) => reject(err));
      });
    } catch (error: any) {
      throw new Error(error?.message || 'Failed to download file');
    }
  }

  async fileExists(bucket: string, objectName: string): Promise<boolean> {
    try {
      const pathParts = objectName.split('/');
      const fileName = pathParts.pop() || objectName;
      const directoryPath = pathParts.join('/') || '';

      const { data, error } = await supabaseClient.storage.from(bucket).list(directoryPath, {
        limit: 1000,
        search: fileName,
      });

      if (error) {
        logger.debug({ error, bucket, objectName }, 'Error checking file existence');
        return false;
      }

      return data?.some((file) => file.name === fileName) || false;
    } catch (error) {
      logger.debug({ error, bucket, objectName }, 'Error checking file existence');
      return false;
    }
  }
}

export default new StorageService();
