import * as fs from 'fs';
import * as path from 'path';
import * as jose from 'node-jose';

interface ServiceAccountKey {
  id: string;
  service_account_id: string;
  created_at: string;
  key_algorithm: string;
  public_key: string;
  private_key: string;
}

interface IAMTokenResponse {
  iamToken: string;
  expiresAt: string;
}

class YandexIAMTokenManager {
  private serviceAccountKey: ServiceAccountKey;
  private currentToken: string | null = null;
  private tokenExpiry: Date | null = null;
  private refreshTimer: NodeJS.Timeout | null = null;

  constructor(keyFilePath: string = './authorized_key.json') {
    const keyPath = path.resolve(keyFilePath);
    
    if (!fs.existsSync(keyPath)) {
      throw new Error(`Service account key file not found: ${keyPath}`);
    }

    try {
      const keyContent = fs.readFileSync(keyPath, 'utf-8');
      this.serviceAccountKey = JSON.parse(keyContent);
      console.log(`✅ Loaded service account key: ${this.serviceAccountKey.id}`);
    } catch (error) {
      throw new Error(`Failed to parse service account key: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Создает JWT токен для аутентификации
   */
  private async createJWT(): Promise<string> {
    const now = Math.floor(Date.now() / 1000);
    const payload = {
      iss: this.serviceAccountKey.service_account_id, // сервисный аккаунт как issuer
      iat: now, // время создания
      exp: now + 3600, // истекает через час
      aud: 'https://iam.api.cloud.yandex.net/iam/v1/tokens' // audience для IAM сервиса
    };

    try {
      // Создаем ключ из приватного ключа
      const key = await jose.JWK.asKey(this.serviceAccountKey.private_key, 'pem', {
        kid: this.serviceAccountKey.id, // key ID
        alg: 'PS256' // алгоритм подписи
      });

      // Подписываем JWT
      const jwt = await jose.JWS.createSign({ format: 'compact' }, key)
        .update(JSON.stringify(payload))
        .final();

      return String(jwt);
    } catch (error) {
      throw new Error(`Failed to create JWT: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Обменивает JWT на IAM токен
   */
  private async exchangeJWTForToken(jwt: string): Promise<IAMTokenResponse> {
    const response = await fetch('https://iam.api.cloud.yandex.net/iam/v1/tokens', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ jwt })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to exchange JWT for IAM token: ${response.status} ${errorText}`);
    }

    const result = await response.json() as IAMTokenResponse;
    return result;
  }

  /**
   * Получает текущий действительный IAM токен
   */
  async getToken(forceRefresh: boolean = false): Promise<string> {
    // Проверяем, нужно ли обновить токен
    const now = new Date();
    const needsRefresh = forceRefresh || 
                        !this.currentToken || 
                        !this.tokenExpiry || 
                        now >= this.tokenExpiry;

    if (needsRefresh) {
      console.log('🔄 Refreshing IAM token...');
      await this.refreshToken();
    }

    if (!this.currentToken) {
      throw new Error('Failed to obtain IAM token');
    }

    return this.currentToken;
  }

  /**
   * Обновляет IAM токен
   */
  private async refreshToken(): Promise<void> {
    try {
      // Создаем JWT
      const jwt = await this.createJWT();
      
      // Обмениваем на IAM токен
      const tokenResponse = await this.exchangeJWTForToken(jwt);
      
      this.currentToken = tokenResponse.iamToken;
      
      // Устанавливаем время истечения (обычно 12 часов, но берем с запасом)
      this.tokenExpiry = new Date(Date.now() + 11 * 60 * 60 * 1000); // 11 часов
      
      console.log(`✅ IAM token refreshed, expires at: ${this.tokenExpiry.toISOString()}`);
      
      // Планируем следующее обновление
      this.scheduleNextRefresh();
      
    } catch (error) {
      console.error('❌ Failed to refresh IAM token:', error);
      throw error;
    }
  }

  /**
   * Планирует следующее обновление токена
   */
  private scheduleNextRefresh(): void {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
    }

    // Обновляем токен каждые 10 часов (с запасом)
    const refreshInterval = 10 * 60 * 60 * 1000; // 10 часов в миллисекундах
    
    this.refreshTimer = setTimeout(() => {
      console.log('⏰ Scheduled IAM token refresh triggered');
      this.refreshToken().catch(error => {
        console.error('❌ Scheduled token refresh failed:', error);
        // Попробуем еще раз через минуту
        setTimeout(() => this.refreshToken().catch(console.error), 60000);
      });
    }, refreshInterval);

    console.log(`⏱️ Next token refresh scheduled in ${refreshInterval / 1000 / 60 / 60} hours`);
  }

  /**
   * Проверяет статус токена
   */
  getTokenStatus(): {
    hasToken: boolean;
    expiresAt: string | null;
    expiresIn: number | null; // секунды до истечения
    isValid: boolean;
  } {
    const now = new Date();
    const expiresIn = this.tokenExpiry ? Math.floor((this.tokenExpiry.getTime() - now.getTime()) / 1000) : null;
    
    return {
      hasToken: !!this.currentToken,
      expiresAt: this.tokenExpiry?.toISOString() || null,
      expiresIn,
      isValid: !!this.currentToken && !!this.tokenExpiry && now < this.tokenExpiry
    };
  }

  /**
   * Останавливает автоматическое обновление
   */
  stop(): void {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
      console.log('🛑 IAM token auto-refresh stopped');
    }
  }

  /**
   * Инициализирует менеджер токенов (получает первый токен)
   */
  async initialize(): Promise<void> {
    console.log('🚀 Initializing Yandex IAM Token Manager...');
    await this.refreshToken();
    console.log('✅ IAM Token Manager initialized successfully');
  }
}

// Синглтон для глобального использования
let globalTokenManager: YandexIAMTokenManager | null = null;

export function getTokenManager(): YandexIAMTokenManager {
  if (!globalTokenManager) {
    globalTokenManager = new YandexIAMTokenManager();
  }
  return globalTokenManager;
}

export { YandexIAMTokenManager };
