import https from 'https';
import FormData from 'form-data';
import { getTokenManager } from './yandex-iam-token-manager';

interface YandexVisionResponse {
  results: Array<{
    results: Array<{
      textDetection: {
        pages: Array<{
          width?: number;
          height?: number;
          blocks: Array<{
            boundingBox: {
              vertices: Array<{
                x: string;
                y: string;
              }>;
            };
            lines: Array<{
              boundingBox: {
                vertices: Array<{
                  x: string;
                  y: string;
                }>;
              };
              words: Array<{
                boundingBox: {
                  vertices: Array<{
                    x: string;
                    y: string;
                  }>;
                };
                text: string;
                confidence: number;
                languages?: Array<{
                  languageCode: string;
                  confidence: number;
                }>;
              }>;
              confidence?: number;
            }>;
          }>;
        }>;
      };
    }>;
  }>;
}

interface OcrResult {
  text: string;
  confidence: number;
  words: Array<{
    text: string;
    confidence: number;
    bbox?: { x: number; y: number; width: number; height: number };
  }>;
}

class YandexVisionService {
  private tokenManager = getTokenManager();
  private folderId: string;

  constructor() {
    // Поддерживаем несколько вариантов переменных для совместимости
    this.folderId = process.env.YANDEX_FOLDER_ID || process.env.YC_FOLDER_ID || '';
    
    if (!this.folderId) {
      throw new Error('YANDEX_FOLDER_ID or YC_FOLDER_ID environment variable is required');
    }
  }

  /**
   * Получает актуальный IAM токен через менеджер токенов
   */
  private async getIamToken(): Promise<string> {
    try {
      // Инициализируем менеджер токенов если нужно
      const status = this.tokenManager.getTokenStatus();
      if (!status.hasToken) {
        await this.tokenManager.initialize();
      }
      
      return await this.tokenManager.getToken();
    } catch (error) {
      throw new Error(`Failed to get IAM token: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Распознает текст в изображении с помощью Yandex Vision API
   */
  async recognizeText(imageBuffer: Buffer, mimeType: string = 'image/jpeg'): Promise<OcrResult> {
    try {
      const iamToken = await this.getIamToken();
      const base64Image = imageBuffer.toString('base64');

      const requestBody = {
        folderId: this.folderId,
        analyze_specs: [{
          content: base64Image,
          features: [{
            type: 'TEXT_DETECTION',
            text_detection_config: {
              language_codes: ['ru', 'en']
            }
          }],
          mime_type: mimeType
        }]
      };

      const postData = JSON.stringify(requestBody);

      const options = {
        hostname: 'vision.api.cloud.yandex.net',
        port: 443,
        path: '/vision/v1/batchAnalyze',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData),
          'Authorization': `Bearer ${iamToken}`
        }
      };

      return new Promise((resolve, reject) => {
        const req = https.request(options, (res) => {
          let data = '';

          res.on('data', (chunk) => {
            data += chunk;
          });

          res.on('end', () => {
            try {
              const response: YandexVisionResponse = JSON.parse(data);
              const result = this.parseVisionResponse(response);
              resolve(result);
            } catch (error) {
              reject(new Error(`Failed to parse Yandex Vision response: ${error instanceof Error ? error.message : String(error)}`));
            }
          });
        });

        req.on('error', (error) => {
          reject(new Error(`Yandex Vision API request failed: ${error.message}`));
        });

        req.write(postData);
        req.end();
      });

    } catch (error) {
      throw new Error(`Yandex Vision OCR failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Парсит ответ от Yandex Vision API
   */
  private parseVisionResponse(response: YandexVisionResponse): OcrResult {
    // Извлекаем textDetection из новой структуры ответа
    const textDetection = response.results?.[0]?.results?.[0]?.textDetection;
    
    if (!textDetection || !textDetection.pages || textDetection.pages.length === 0) {
      return {
        text: '',
        confidence: 0,
        words: []
      };
    }

    const words: Array<{
      text: string;
      confidence: number;
      bbox?: { x: number; y: number; width: number; height: number };
    }> = [];

    let totalConfidence = 0;
    let wordCount = 0;
    let fullText = '';

    // Извлекаем слова из страниц -> блоков -> строк -> слов
    textDetection.pages.forEach(page => {
      page.blocks?.forEach(block => {
        block.lines?.forEach(line => {
          line.words?.forEach(word => {
            if (word.text && word.confidence !== undefined) {
              // Добавляем текст с пробелами
              if (fullText.length > 0) {
                fullText += ' ';
              }
              fullText += word.text;

              // Вычисляем bounding box (координаты теперь строки, конвертируем в числа)
              let bbox;
              if (word.boundingBox?.vertices?.length >= 4) {
                const vertices = word.boundingBox.vertices;
                const minX = Math.min(...vertices.map(v => parseInt(v.x, 10)));
                const maxX = Math.max(...vertices.map(v => parseInt(v.x, 10)));
                const minY = Math.min(...vertices.map(v => parseInt(v.y, 10)));
                const maxY = Math.max(...vertices.map(v => parseInt(v.y, 10)));
                
                bbox = {
                  x: minX,
                  y: minY,
                  width: maxX - minX,
                  height: maxY - minY
                };
              }

              words.push({
                text: word.text,
                confidence: word.confidence,
                bbox
              });

              totalConfidence += word.confidence;
              wordCount++;
            }
          });
          
          // Добавляем перенос строки между строками
          if (fullText.length > 0) {
            fullText += '\n';
          }
        });
      });
    });

    const averageConfidence = wordCount > 0 ? totalConfidence / wordCount : 0;

    return {
      text: fullText.trim(),
      confidence: averageConfidence,
      words
    };
  }

  /**
   * Проверяет работоспособность Yandex Vision API
   */
  async healthCheck(): Promise<boolean> {
    try {
      const iamToken = await this.getIamToken();
      
      // Создаем минимальное изображение для тестирования (1x1 пиксель PNG)
      const testImage = Buffer.from([
        0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52,
        0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,
        0xDE, 0x00, 0x00, 0x00, 0x0C, 0x49, 0x44, 0x41, 0x54, 0x08, 0xD7, 0x63, 0xF8, 0x0F, 0x00, 0x00,
        0x01, 0x00, 0x01, 0x5C, 0xC2, 0x8A, 0x6B, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE,
        0x42, 0x60, 0x82
      ]);

      await this.recognizeText(testImage, 'image/png');
      return true;
    } catch (error) {
      console.error('Yandex Vision health check failed:', error instanceof Error ? error.message : String(error));
      return false;
    }
  }

  /**
   * Получает статус токен менеджера
   */
  getTokenManagerStatus() {
    return this.tokenManager.getTokenStatus();
  }

  /**
   * Принудительно обновляет токен
   */
  async refreshToken() {
    return await this.tokenManager.getToken(true);
  }
}

// Создаем единственный экземпляр сервиса
let yandexVisionInstance: YandexVisionService | null = null;

/**
 * Получает экземпляр Yandex Vision сервиса (синглтон)
 */
function getYandexVisionService(): YandexVisionService {
  if (!yandexVisionInstance) {
    yandexVisionInstance = new YandexVisionService();
  }
  return yandexVisionInstance;
}

/**
 * Главная функция для обработки изображений через Yandex Vision OCR
 * Совместимость с многоуровневой системой OCR
 */
export async function processImageWithYandex(buffer: Buffer): Promise<OcrResult> {
  try {
    const service = getYandexVisionService();
    
    // Определяем MIME тип по сигнатуре
    let mimeType = 'image/jpeg';
    if (buffer.length > 8) {
      const header = buffer.toString('hex', 0, 8);
      if (header.startsWith('89504e47')) {
        mimeType = 'image/png';
      } else if (header.startsWith('47494638')) {
        mimeType = 'image/gif';
      } else if (header.startsWith('424d')) {
        mimeType = 'image/bmp';
      }
    }
    
    return await service.recognizeText(buffer, mimeType);
  } catch (error: any) {
    throw new Error(`YANDEX_VISION_OCR_FAILED: ${error.message}`);
  }
}

/**
 * Проверка доступности Yandex Vision API
 */
export async function checkYandexVisionHealth(): Promise<boolean> {
  try {
    const service = getYandexVisionService();
    return await service.healthCheck();
  } catch (error) {
    console.error('Yandex Vision health check failed:', error);
    return false;
  }
}

export { YandexVisionService, type OcrResult };