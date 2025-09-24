/**
 * Yandex Cloud Object Storage (S3-compatible) utilities
 * Функции для загрузки и скачивания файлов
 */

import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const DEBUG = process.env.DEBUG_S3 === 'true';
const log = (...args: any[]) => DEBUG && console.log('🗄️ S3:', ...args);

// Конфигурация S3 клиента для Yandex Cloud
const s3Client = new S3Client({
  region: process.env.YC_REGION || 'ru-central1',
  endpoint: process.env.YC_S3_ENDPOINT || 'https://storage.yandexcloud.net',
  credentials: {
    accessKeyId: process.env.YC_ACCESS_KEY_ID!,
    secretAccessKey: process.env.YC_SECRET_ACCESS_KEY!,
  },
  forcePathStyle: true, // Важно для Yandex Cloud
});

const bucketName = process.env.YC_BUCKET_NAME!;

/**
 * Скачивание файла из Yandex Object Storage
 */
export async function getFileBuffer(fileKey: string): Promise<{ buffer: Buffer; mime: string }> {
  try {
    log(`Downloading file from S3: ${fileKey}`);
    
    const command = new GetObjectCommand({
      Bucket: bucketName,
      Key: fileKey,
    });
    
    const response = await s3Client.send(command);
    
    if (!response.Body) {
      throw new Error('Empty response body from S3');
    }
    
    // Преобразуем stream в buffer
    const chunks: Uint8Array[] = [];
    const reader = response.Body.transformToWebStream().getReader();
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }
    
    const buffer = Buffer.concat(chunks);
    const mime = response.ContentType || 'application/octet-stream';
    
    log(`File downloaded successfully. Size: ${buffer.length} bytes, MIME: ${mime}`);
    
    return { buffer, mime };
    
  } catch (error: any) {
    log('S3 download failed:', error.message);
    throw new Error(`S3_DOWNLOAD_FAILED: ${error.message}`);
  }
}

/**
 * Загрузка файла в Yandex Object Storage
 */
export async function uploadFile(fileKey: string, buffer: Buffer, contentType: string): Promise<string> {
  try {
    log(`Uploading file to S3: ${fileKey}, size: ${buffer.length} bytes`);
    
    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: fileKey,
      Body: buffer,
      ContentType: contentType,
      ContentLength: buffer.length,
    });
    
    await s3Client.send(command);
    
    log(`File uploaded successfully: ${fileKey}`);
    
    // Возвращаем public URL (если bucket публичный) или генерируем signed URL
    return `https://${bucketName}.storage.yandexcloud.net/${fileKey}`;
    
  } catch (error: any) {
    log('S3 upload failed:', error.message);
    throw new Error(`S3_UPLOAD_FAILED: ${error.message}`);
  }
}

/**
 * Генерация подписанного URL для скачивания файла
 */
export async function getSignedDownloadUrl(fileKey: string, expiresIn: number = 3600): Promise<string> {
  try {
    const command = new GetObjectCommand({
      Bucket: bucketName,
      Key: fileKey,
    });
    
    const signedUrl = await getSignedUrl(s3Client, command, { expiresIn });
    
    log(`Generated signed URL for ${fileKey}, expires in ${expiresIn}s`);
    
    return signedUrl;
    
  } catch (error: any) {
    log('Signed URL generation failed:', error.message);
    throw new Error(`SIGNED_URL_FAILED: ${error.message}`);
  }
}

/**
 * Генерация подписанного URL для загрузки файла
 */
export async function getSignedUploadUrl(fileKey: string, contentType: string, expiresIn: number = 3600): Promise<string> {
  try {
    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: fileKey,
      ContentType: contentType,
    });
    
    const signedUrl = await getSignedUrl(s3Client, command, { expiresIn });
    
    log(`Generated signed upload URL for ${fileKey}, expires in ${expiresIn}s`);
    
    return signedUrl;
    
  } catch (error: any) {
    log('Signed upload URL generation failed:', error.message);
    throw new Error(`SIGNED_UPLOAD_URL_FAILED: ${error.message}`);
  }
}

/**
 * Удаление файла из Yandex Object Storage
 */
export async function deleteFile(fileKey: string): Promise<void> {
  try {
    log(`Deleting file from S3: ${fileKey}`);
    
    const { DeleteObjectCommand } = await import('@aws-sdk/client-s3');
    const command = new DeleteObjectCommand({
      Bucket: bucketName,
      Key: fileKey,
    });
    
    await s3Client.send(command);
    
    log(`File deleted successfully: ${fileKey}`);
    
  } catch (error: any) {
    log('S3 delete failed:', error.message);
    throw new Error(`S3_DELETE_FAILED: ${error.message}`);
  }
}

/**
 * Генерация уникального ключа файла
 */
export function generateFileKey(fileName: string, fileType?: string): string {
  const timestamp = Date.now();
  const randomId = Math.random().toString(36).substring(2, 15);
  const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
  
  const prefix = fileType ? `${fileType}/` : '';
  const fileKey = `${prefix}${timestamp}_${randomId}_${sanitizedFileName}`;
  
  log(`Generated file key: ${fileKey}`);
  
  return fileKey;
}

/**
 * Проверка существования файла
 */
export async function fileExists(fileKey: string): Promise<boolean> {
  try {
    const { HeadObjectCommand } = await import('@aws-sdk/client-s3');
    const command = new HeadObjectCommand({
      Bucket: bucketName,
      Key: fileKey,
    });
    
    await s3Client.send(command);
    return true;
    
  } catch (error: any) {
    if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
      return false;
    }
    throw error;
  }
}

/**
 * Получение метаданных файла
 */
export async function getFileMetadata(fileKey: string): Promise<{
  size: number;
  contentType: string;
  lastModified: Date;
}> {
  try {
    const { HeadObjectCommand } = await import('@aws-sdk/client-s3');
    const command = new HeadObjectCommand({
      Bucket: bucketName,
      Key: fileKey,
    });
    
    const response = await s3Client.send(command);
    
    return {
      size: response.ContentLength || 0,
      contentType: response.ContentType || 'application/octet-stream',
      lastModified: response.LastModified || new Date(),
    };
    
  } catch (error: any) {
    log('Get file metadata failed:', error.message);
    throw new Error(`GET_METADATA_FAILED: ${error.message}`);
  }
}