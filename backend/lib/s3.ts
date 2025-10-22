/**
 * Yandex Cloud Object Storage (S3-compatible) utilities
 * Функции для загрузки и скачивания файлов
 */

import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const DEBUG = process.env.DEBUG_S3 === 'true';
const log = (...args: any[]) => DEBUG && console.log('🗄️ S3:', ...args);

// Ленивая инициализация S3 клиента (создается при первом использовании)
let s3ClientInstance: S3Client | null = null;

const getS3Client = () => {
  if (!s3ClientInstance) {
    const accessKeyId = process.env.YC_ACCESS_KEY_ID;
    const secretAccessKey = process.env.YC_SECRET_ACCESS_KEY;
    const region = process.env.YC_REGION || 'ru-central1';
    const endpoint = process.env.YC_S3_ENDPOINT || 'https://storage.yandexcloud.net';

    console.log('🔧 [S3 INIT] Initializing S3 Client...');
    console.log('🔧 [S3 INIT] Region:', region);
    console.log('🔧 [S3 INIT] Endpoint:', endpoint);
    console.log('🔧 [S3 INIT] Access Key ID:', accessKeyId ? `${accessKeyId.substring(0, 10)}...` : '❌ NOT SET');
    console.log('🔧 [S3 INIT] Secret Key:', secretAccessKey ? '✅ present' : '❌ NOT SET');

    if (!accessKeyId || !secretAccessKey) {
      throw new Error('YC_ACCESS_KEY_ID and YC_SECRET_ACCESS_KEY environment variables must be set');
    }

    s3ClientInstance = new S3Client({
      region,
      endpoint,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
      forcePathStyle: true, // Важно для Yandex Cloud
    });

    console.log('✅ [S3 INIT] S3 Client initialized successfully');
  }
  return s3ClientInstance;
};

// Читаем bucket name динамически, чтобы поддерживать загрузку .env в runtime
const getBucketName = () => {
  const bucket = process.env.YC_BUCKET_NAME;
  if (!bucket) {
    throw new Error('YC_BUCKET_NAME environment variable is not set');
  }
  return bucket;
};

/**
 * Скачивание файла из Yandex Object Storage
 */
export async function getFileBuffer(fileKey: string): Promise<{ buffer: Buffer; mime: string }> {
  try {
    log(`Downloading file from S3: ${fileKey}`);

    const command = new GetObjectCommand({
      Bucket: getBucketName(),
      Key: fileKey,
    });

    const response = await getS3Client().send(command);
    
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

    const bucket = getBucketName();
    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: fileKey,
      Body: buffer,
      ContentType: contentType,
      ContentLength: buffer.length,
    });

    await getS3Client().send(command);

    log(`File uploaded successfully: ${fileKey}`);

    // Возвращаем public URL (если bucket публичный) или генерируем signed URL
    return `https://${bucket}.storage.yandexcloud.net/${fileKey}`;
    
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
      Bucket: getBucketName(),
      Key: fileKey,
    });

    const signedUrl = await getSignedUrl(getS3Client(), command, { expiresIn });
    
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
      Bucket: getBucketName(),
      Key: fileKey,
      ContentType: contentType,
    });

    const signedUrl = await getSignedUrl(getS3Client(), command, { expiresIn });
    
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
      Bucket: getBucketName(),
      Key: fileKey,
    });

    await getS3Client().send(command);
    
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
      Bucket: getBucketName(),
      Key: fileKey,
    });

    await getS3Client().send(command);
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
      Bucket: getBucketName(),
      Key: fileKey,
    });

    const response = await getS3Client().send(command);
    
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