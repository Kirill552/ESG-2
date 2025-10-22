/**
 * Сервис для работы с StarLine Maps API
 * Документация: https://maps.starline.ru/documentation/
 *
 * Функции:
 * - Geocoding: преобразование названия города в координаты
 * - Routing: расчёт расстояния между городами по автодорогам
 */

import 'dotenv/config';

export interface Coordinates {
  lat: number;
  lon: number;
}

export interface GeocodeResult {
  coordinates: Coordinates;
  city: string;
  confidence: number;
}

export interface RoutingResult {
  distance: number; // км
  duration: number; // секунды
  confidence: number;
}

export class StarLineMapsService {
  private baseUrl: string;
  private apiKey: string;

  constructor(apiKey?: string) {
    this.baseUrl = 'https://maps.starline.ru/api';
    this.apiKey = apiKey || process.env.STARLINE_API_KEY || '';

    if (!this.apiKey) {
      console.warn('⚠️ STARLINE_API_KEY не установлен! StarLine Maps API не будет работать.');
    }
  }

  /**
   * Получить координаты города через Geocoder API
   */
  async geocodeCity(cityName: string): Promise<GeocodeResult | null> {
    if (!this.apiKey) {
      console.error('❌ StarLine API key не установлен');
      return null;
    }

    try {
      console.log(`🗺️ StarLine Geocoder: поиск координат для "${cityName}"...`);

      // Добавляем object_type=city для поиска только городов
      const url = `${this.baseUrl}/geocoder/v2/forward?query=${encodeURIComponent(cityName)}&object_type=city&limit=1`;

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`
        }
      });

      if (!response.ok) {
        console.error(`❌ StarLine Geocoder ошибка: ${response.status} ${response.statusText}`);
        return null;
      }

      const data = await response.json();

      // Логируем ответ для отладки
      console.log('📋 StarLine Geocoder response:', JSON.stringify(data).substring(0, 200));

      // StarLine может вернуть:
      // 1. GeoJSON: {type: "FeatureCollection", features: [...]}
      // 2. JSON array: [{...}]
      let features = [];

      if (data?.features && Array.isArray(data.features)) {
        // GeoJSON формат
        features = data.features;
      } else if (Array.isArray(data)) {
        // JSON array формат
        features = data;
      }

      // Извлекаем координаты из первого результата
      if (features.length > 0) {
        const feature = features[0];

        // Координаты могут быть в geometry.coordinates (GeoJSON) или в properties (JSON)
        let coordinates: Coordinates;

        if (feature.geometry?.coordinates && feature.geometry.coordinates.length >= 2) {
          // GeoJSON формат: geometry.coordinates = [lon, lat]
          coordinates = {
            lon: feature.geometry.coordinates[0],
            lat: feature.geometry.coordinates[1]
          };
        } else if (feature.lat && feature.lon) {
          // JSON формат: прямые поля lat, lon
          coordinates = {
            lat: feature.lat,
            lon: feature.lon
          };
        } else {
          console.error('❌ StarLine Geocoder: координаты не найдены');
          console.error('   Feature structure:', Object.keys(feature));
          return null;
        }

        // Используем display_name из спецификации (или прямые поля в JSON формате)
        const resultCity = feature.display_name ||
                          feature.properties?.display_name ||
                          feature.properties?.name ||
                          feature.address?.name ||
                          feature.properties?.address?.city ||
                          cityName;

        console.log(`✅ StarLine Geocoder: найден "${resultCity}" (lat: ${coordinates.lat.toFixed(4)}, lon: ${coordinates.lon.toFixed(4)})`);

        return {
          coordinates,
          city: resultCity,
          confidence: 0.9 // StarLine Maps - надёжный источник для РФ
        };
      }

      console.warn(`⚠️ StarLine Geocoder: город "${cityName}" не найден (features: ${features.length})`);
      return null;

    } catch (error) {
      console.error('❌ StarLine Geocoder ошибка:', error);
      return null;
    }
  }

  /**
   * Рассчитать расстояние между двумя городами
   */
  async calculateRoute(
    fromCity: string,
    toCity: string,
    transportType: 'auto' | 'truck' | 'bicycle' | 'pedestrian' = 'auto'
  ): Promise<RoutingResult | null> {
    if (!this.apiKey) {
      console.error('❌ StarLine API key не установлен');
      return null;
    }

    try {
      console.log(`🗺️ StarLine Routing: расчёт маршрута ${fromCity} → ${toCity} (${transportType})...`);

      // Шаг 1: Получить координаты обоих городов
      const [fromCoords, toCoords] = await Promise.all([
        this.geocodeCity(fromCity),
        this.geocodeCity(toCity)
      ]);

      if (!fromCoords || !toCoords) {
        console.error('❌ Не удалось получить координаты городов');
        return null;
      }

      // Шаг 2: Рассчитать маршрут
      const url = `${this.baseUrl}/routing/route`;

      const requestBody = {
        locations: [
          {
            lat: fromCoords.coordinates.lat,
            lon: fromCoords.coordinates.lon,
            type: 'break'
          },
          {
            lat: toCoords.coordinates.lat,
            lon: toCoords.coordinates.lon,
            type: 'break'
          }
        ],
        costing: transportType
      };

      console.log('📋 StarLine Routing request:', JSON.stringify(requestBody, null, 2));

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        console.error(`❌ StarLine Routing ошибка: ${response.status} ${response.statusText}`);
        return null;
      }

      const data = await response.json();

      // Логируем ответ для отладки
      console.log('📋 StarLine Routing response:', JSON.stringify(data).substring(0, 300));

      // Извлекаем расстояние и время согласно официальной спецификации StarLine
      // Формат ответа: { code: "Ok", uuid: "...", routes: [{distance: meters, duration: seconds, ...}] }
      if (data?.routes && Array.isArray(data.routes) && data.routes.length > 0) {
        const route = data.routes[0]; // Берем первый (основной) маршрут

        // distance в метрах, duration в секундах
        const distanceMeters = route.distance || 0;
        const durationSeconds = route.duration || 0;

        if (distanceMeters > 0) {
          // Конвертируем метры в километры
          const distanceKm = distanceMeters / 1000;
          console.log(`✅ StarLine Routing: ${distanceKm.toFixed(1)} км, ${(durationSeconds / 3600).toFixed(1)} ч`);

          return {
            distance: distanceKm,
            duration: durationSeconds,
            confidence: 0.95 // StarLine Maps - точные данные для РФ
          };
        }
      }

      console.warn('⚠️ StarLine Routing: маршрут не найден или пустой ответ');
      console.warn('   Response structure:', Object.keys(data || {}));
      if (data?.routes) {
        console.warn('   First route keys:', Object.keys(data.routes[0] || {}));
      }
      return null;

    } catch (error) {
      console.error('❌ StarLine Routing ошибка:', error);
      return null;
    }
  }

  /**
   * Проверить доступность API
   */
  async checkHealth(): Promise<boolean> {
    if (!this.apiKey) {
      return false;
    }

    try {
      // Простой тестовый запрос
      const testCity = 'Москва';
      const result = await this.geocodeCity(testCity);
      return result !== null;
    } catch {
      return false;
    }
  }
}

// Экспорт синглтона
export const starLineMapsService = new StarLineMapsService();
