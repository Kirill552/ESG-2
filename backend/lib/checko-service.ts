// Используем встроенный fetch из Node.js 18+

export interface CheckoOrgResponse {
  inn: string;
  kpp?: string;
  ogrn?: string;
  name?: string;
  short_name?: string;
  address?: string;
  phone?: string;
  okved?: string;
  bank_accounts?: Array<{ bic?: string; account?: string; bank_name?: string }>;
}

export class CheckoService {
  private apiKey: string | undefined;
  private baseUrl = 'https://api.checko.ru';

  constructor(apiKey?: string) {
    this.apiKey = apiKey ?? process.env.CHECKO_API_KEY;
  }

  async getByInn(inn: string): Promise<CheckoOrgResponse | null> {
    if (!this.apiKey) return null;
    try {
      // 1) Основной эндпоинт: /v2/company?inn=
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      const url1 = `${this.baseUrl}/v2/company?key=${encodeURIComponent(this.apiKey)}&inn=${encodeURIComponent(inn)}`;
      const res1 = await fetch(url1, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (res1.ok) {
        const json: any = await res1.json();
        const d = json?.data;
        if (d) {
          // Нормализуем «русский» формат в ожидаемый интерфейс
          return {
            inn: d.ИНН || inn,
            kpp: d.КПП,
            ogrn: d.ОГРН,
            name: d.НаимПолн || d.НаимСокр,
            short_name: d.НаимСокр || d.НаимПолн,
            address: d.ЮрАдрес?.АдресРФ,
            phone: d.Связь?.Телефон || d.Телефон,
            okved: d.ОКВЭД?.Код,
            bank_accounts: Array.isArray(d.БанковскиеСчета)
              ? d.БанковскиеСчета.map((b: any) => ({
                  bic: b.БИК || b.bic,
                  account: b.РС || b.account,
                  bank_name: b.Банк || b.bank_name,
                }))
              : undefined,
          };
        }
      }

      // 2) Фолбэк: старый/альтернативный эндпоинт /v2/companies/{inn}
      const controller2 = new AbortController();
      const timeoutId2 = setTimeout(() => controller2.abort(), 10000);
      const url2 = `${this.baseUrl}/v2/companies/${encodeURIComponent(inn)}?key=${encodeURIComponent(this.apiKey)}`;
      const res2 = await fetch(url2, { signal: controller2.signal });
      clearTimeout(timeoutId2);
      if (!res2.ok) return null;
      const data2: any = await res2.json();
      // если структура уже «нормальная», просто вернём как есть; иначе попытаемся привести
      if (data2 && (data2.inn || data2.name || data2.short_name)) {
        return data2 as CheckoOrgResponse;
      }
      const d2 = data2?.data;
      if (d2) {
        return {
          inn: d2.ИНН || inn,
          kpp: d2.КПП,
          ogrn: d2.ОГРН,
          name: d2.НаимПолн || d2.НаимСокр,
          short_name: d2.НаимСокр || d2.НаимПолн,
          address: d2.ЮрАдрес?.АдресРФ,
          phone: d2.Связь?.Телефон || d2.Телефон,
          okved: d2.ОКВЭД?.Код,
          bank_accounts: Array.isArray(d2.БанковскиеСчета)
            ? d2.БанковскиеСчета.map((b: any) => ({
                bic: b.БИК || b.bic,
                account: b.РС || b.account,
                bank_name: b.Банк || b.bank_name,
              }))
            : undefined,
        } as CheckoOrgResponse;
      }
      return null;
    } catch (e) {
      console.warn('Checko getByInn error:', e);
      return null;
    }
  }
}

export const checkoService = new CheckoService();


