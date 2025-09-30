/**
 * Демо-данные для ESG-Лайт
 * Содержит все моковые данные, которые видят пользователи в демо-режиме
 */

// Статистика для дашборда
export const DEMO_STATS = [
  {
    title: 'Общие выбросы',
    value: 1247,
    unit: 'тСО₂-экв',
    change: -5.2,
    period: 'к прошлому году',
    icon: 'Leaf',
    color: 'green',
    metric: 'co2' as const
  },
  {
    title: 'Документов загружено',
    value: 89,
    unit: 'файлов',
    change: 12.5,
    period: 'за месяц',
    icon: 'FileText',
    color: 'blue'
  },
  {
    title: 'Готовых отчетов',
    value: 23,
    unit: 'отчета',
    change: 8.1,
    period: 'за квартал',
    icon: 'FileCheck',
    color: 'purple'
  },
  {
    title: 'Экономия времени',
    value: 156,
    unit: 'часов',
    change: 45.2,
    period: 'за год',
    icon: 'Zap',
    color: 'orange'
  }
];

// Документы для демо
export const DEMO_DOCUMENTS = [
  {
    id: 'demo-1',
    name: 'Энергопотребление_Q4.xlsx',
    status: 'processed',
    date: '2 часа назад',
    size: '2.4 МБ',
    type: 'xlsx',
    uploadedBy: 'Система',
    processedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
  },
  {
    id: 'demo-2',
    name: 'Транспорт_данные.pdf',
    status: 'processing',
    date: '4 часа назад',
    size: '1.8 МБ',
    type: 'pdf',
    uploadedBy: 'Система',
    uploadedAt: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString()
  },
  {
    id: 'demo-3',
    name: 'Производство_отчет.docx',
    status: 'pending',
    date: '1 день назад',
    size: '956 КБ',
    type: 'docx',
    uploadedBy: 'Система',
    uploadedAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  },
  {
    id: 'demo-4',
    name: 'Поставщики_выбросы.csv',
    status: 'processed',
    date: '2 дня назад',
    size: '3.2 МБ',
    type: 'csv',
    uploadedBy: 'Система',
    processedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    id: 'demo-5',
    name: 'Отходы_Q3_2024.xlsx',
    status: 'processed',
    date: '3 дня назад',
    size: '1.5 МБ',
    type: 'xlsx',
    uploadedBy: 'Система',
    processedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()
  }
];

// Отчеты для демо (упрощенные статусы для MVP)
export const DEMO_REPORTS = [
  {
    id: 'rep-1',
    name: 'Годовой отчет о выбросах ПГ 2024',
    type: '296-ФЗ Годовой',
    period: '2024',
    status: 'draft', // Черновик
    createdDate: '10.12.2024',
    submissionDeadline: '31.03.2025',
    totalEmissions: 1247.8,
    documentCount: 156
  },
  {
    id: 'rep-2',
    name: 'Годовой отчет о выбросах ПГ 2023',
    type: '296-ФЗ Годовой',
    period: '2023',
    status: 'ready', // Готов (заменили approved на ready для MVP)
    createdDate: '15.02.2024',
    submissionDeadline: '31.03.2024',
    totalEmissions: 1156.3,
    documentCount: 142
  },
  {
    id: 'rep-3',
    name: 'Годовой отчет о выбросах ПГ 2022',
    type: '296-ФЗ Годовой',
    period: '2022',
    status: 'ready', // Готов (заменили approved на ready для MVP)
    createdDate: '20.02.2023',
    submissionDeadline: '31.03.2023',
    totalEmissions: 1089.7,
    documentCount: 128
  }
];

// Статистика отчетов для демо (упрощенная для MVP)
export const DEMO_REPORTS_STATS = {
  total: 3,                 // Всего отчетов
  ready_to_send: 2,        // Готовы к отправке (статус "ready") - было "approved", теперь "ready"
  close_deadlines: 0,      // Близкие дедлайны (до 7 дней)
  approved: 0              // Утвержденные отчеты (скрыто для MVP)
};

// Аналитические данные для демо
export const DEMO_ANALYTICS = {
  // Данные для графиков выбросов по месяцам
  monthlyEmissions: [
    { month: 'Янв', value: 1150, scope1: 450, scope2: 700, scope3: 0 },
    { month: 'Фев', value: 1200, scope1: 480, scope2: 720, scope3: 0 },
    { month: 'Мар', value: 1180, scope1: 470, scope2: 710, scope3: 0 },
    { month: 'Апр', value: 1220, scope1: 490, scope2: 730, scope3: 0 },
    { month: 'Май', value: 1160, scope1: 460, scope2: 700, scope3: 0 },
    { month: 'Июн', value: 1140, scope1: 440, scope2: 700, scope3: 0 },
    { month: 'Июл', value: 1190, scope1: 475, scope2: 715, scope3: 0 },
    { month: 'Авг', value: 1210, scope1: 485, scope2: 725, scope3: 0 },
    { month: 'Сен', value: 1175, scope1: 465, scope2: 710, scope3: 0 },
    { month: 'Окт', value: 1230, scope1: 495, scope2: 735, scope3: 0 },
    { month: 'Ноя', value: 1205, scope1: 480, scope2: 725, scope3: 0 },
    { month: 'Дек', value: 1247, scope1: 497, scope2: 750, scope3: 0 }
  ],

  // Распределение по источникам
  emissionSources: [
    { name: 'Энергия', value: 45, amount: 561 },
    { name: 'Транспорт', value: 25, amount: 312 },
    { name: 'Производство', value: 20, amount: 249 },
    { name: 'Отходы', value: 7, amount: 87 },
    { name: 'Прочее', value: 3, amount: 38 }
  ],

  // KPI метрики
  kpiMetrics: {
    totalEmissions: 1247,
    emissionIntensity: 0.24,
    renewableEnergy: 35,
    wasteRecycled: 78,
    carbonOffset: 156
  }
};

// Настройки пользователя для демо
export const DEMO_USER_SETTINGS = {
  profile: {
    name: 'Демо Пользователь',
    email: 'demo@esg-lite.ru',
    company: 'ООО "Демо Компания"',
    position: 'Эколог',
    phone: '+7 (XXX) XXX-XX-XX'
  },
  notifications: {
    emailReports: true,
    processing: true,
    newFeatures: false,
    maintenance: true
  },
  security: {
    passkey: false, // По умолчанию выключен в демо
    twoFactor: false,
    lastLogin: new Date().toISOString()
  }
};

// Расширенные аналитические данные для демо
export const DEMO_COMPLIANCE_DATA = {
  compliance296FZ: {
    status: 'Полное',
    level: 'high',
    score: 98.5,
    details: [
      { requirement: 'Своевременная подача отчетов', status: 'Выполнено', score: 100 },
      { requirement: 'Полнота данных по выбросам', status: 'Выполнено', score: 99.2 },
      { requirement: 'Корректность расчетов', status: 'Выполнено', score: 98.8 },
      { requirement: 'Документооборот', status: 'Выполнено', score: 96.5 }
    ]
  },
  timelySubmission: {
    status: 'В срок',
    level: 'good',
    daysBeforeDeadline: 45,
    details: {
      nextDeadline: '31.03.2025',
      reportsPending: 0,
      reportsReady: 1,
      averageSubmissionTime: '15 дней до дедлайна'
    }
  },
  dataCompleteness: {
    percentage: 99.2,
    level: 'excellent',
    breakdown: {
      scope1: { percentage: 100, status: 'Полные данные' },
      scope2: { percentage: 99.8, status: 'Незначительные пропуски' },
      scope3: { percentage: 96.5, status: 'Опциональные данные' },
      supportingDocuments: { percentage: 100, status: 'Все документы загружены' }
    },
    missingData: ['Уточнение коэффициентов для некоторых видов топлива (Scope 3)']
  },
  reportQuality: {
    status: 'Высокое',
    level: 'high',
    score: 94.2,
    metrics: {
      accuracy: 98.5,
      consistency: 92.8,
      documentation: 95.5,
      methodology: 90.0
    },
    improvements: [
      'Автоматизация проверки данных',
      'Улучшение методологии расчета Scope 3'
    ]
  }
};

// Данные дашборда с прогрессом 296-ФЗ
export const DEMO_DASHBOARD_PROGRESS = {
  dataCollection: {
    label: 'Сбор данных',
    percentage: 85,
    color: 'green'
  },
  documentProcessing: {
    label: 'Обработка документов',
    percentage: 72,
    color: 'blue'
  },
  reportGeneration: {
    label: 'Создание отчетов',
    percentage: 45,
    color: 'orange'
  }
};

// Данные для сравнения периодов
export const DEMO_YEAR_COMPARISON = [
  {
    category: 'Энергия',
    previousYear: 532,
    currentYear: 561,
    change: 5.5
  },
  {
    category: 'Транспорт',
    previousYear: 289,
    currentYear: 312,
    change: 8.0
  },
  {
    category: 'Производство',
    previousYear: 267,
    currentYear: 249,
    change: -6.7
  },
  {
    category: 'Отходы',
    previousYear: 92,
    currentYear: 87,
    change: -5.4
  }
];

// Детализированная разбивка выбросов
export const DEMO_DETAILED_BREAKDOWN = {
  scope1: {
    total: 497,
    categories: [
      { name: 'Сжигание топлива', value: 298, percentage: 60.0 },
      { name: 'Промышленные процессы', value: 149, percentage: 30.0 },
      { name: 'Утечки', value: 50, percentage: 10.0 }
    ]
  },
  scope2: {
    total: 750,
    categories: [
      { name: 'Электроэнергия', value: 525, percentage: 70.0 },
      { name: 'Тепло', value: 225, percentage: 30.0 }
    ]
  },
  scope3: {
    total: 0,
    categories: []
  }
};

// Тренды и показатели
export const DEMO_TRENDS = {
  yearOverYear: -5.2,
  quarterOverQuarter: 2.1,
  monthOverMonth: 0.8,
  peakMonth: 'Октябрь',
  lowestMonth: 'Июнь'
};

// Уведомления для демо-режима
export const DEMO_NOTIFICATIONS = [
  {
    id: 'demo-notif-1',
    type: 'document_processed',
    title: 'Документ успешно обработан',
    message: 'Файл "Энергопотребление_Q4.xlsx" успешно обработан через OCR. Распознано 4,523 символа.',
    read: false,
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 часа назад
    metadata: {
      documentId: 'demo-1',
      fileName: 'Энергопотребление_Q4.xlsx',
      textLength: 4523,
      link: '/documents'
    }
  },
  {
    id: 'demo-notif-2',
    type: 'report_ready',
    title: 'Отчёт готов к отправке',
    message: 'Отчёт "296-ФЗ Годовой 2024" готов к отправке в регулятор. Проверьте данные перед отправкой.',
    read: false,
    createdAt: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(), // 5 часов назад
    metadata: {
      reportId: 'demo-report-1',
      reportName: '296-ФЗ Годовой 2024',
      reportType: '296-ФЗ Годовой',
      totalEmissions: 1247.8,
      link: '/reports/demo-report-1'
    }
  },
  {
    id: 'demo-notif-3',
    type: 'deadline_7_days',
    title: 'Напоминание: до дедлайна отчёта "Квартальный отчёт Q4" осталось 7 дней',
    message: 'Срок подачи отчёта: 31 декабря 2024 г. Осталось 7 дней. Проверьте готовность данных.',
    read: true,
    createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // 1 день назад
    metadata: {
      reportId: 'demo-report-2',
      reportName: 'Квартальный отчёт Q4',
      deadline: '31 декабря 2024 г.',
      daysLeft: 7,
      reportStatus: 'DRAFT',
      link: '/reports/demo-report-2'
    }
  },
  {
    id: 'demo-notif-4',
    type: 'document_uploaded',
    title: 'Документ успешно загружен',
    message: 'Файл "Транспорт_данные.pdf" загружен и поставлен в очередь на обработку.',
    read: true,
    createdAt: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(), // 4 часа назад
    metadata: {
      documentId: 'demo-2',
      fileName: 'Транспорт_данные.pdf',
      fileSize: 1887436,
      link: '/documents'
    }
  },
  {
    id: 'demo-notif-5',
    type: 'system_alert',
    title: 'Добро пожаловать в ESG-Лайт!',
    message: 'Вы находитесь в демо-режиме. Все данные являются примерами. Для получения полного доступа нажмите "Получить доступ" на странице тарифов.',
    read: true,
    createdAt: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(), // 2 дня назад
    metadata: {
      link: '/pricing'
    }
  }
];

// Функция для получения демо-данных по типу
export function getDemoData(type: 'stats' | 'documents' | 'reports' | 'reports_stats' | 'analytics' | 'settings' | 'compliance' | 'dashboard_progress' | 'year_comparison' | 'detailed_breakdown' | 'trends' | 'notifications') {
  switch (type) {
    case 'stats':
      return DEMO_STATS;
    case 'documents':
      return DEMO_DOCUMENTS;
    case 'reports':
      return DEMO_REPORTS;
    case 'reports_stats':
      return DEMO_REPORTS_STATS;
    case 'analytics':
      return DEMO_ANALYTICS;
    case 'settings':
      return DEMO_USER_SETTINGS;
    case 'compliance':
      return DEMO_COMPLIANCE_DATA;
    case 'dashboard_progress':
      return DEMO_DASHBOARD_PROGRESS;
    case 'year_comparison':
      return DEMO_YEAR_COMPARISON;
    case 'detailed_breakdown':
      return DEMO_DETAILED_BREAKDOWN;
    case 'trends':
      return DEMO_TRENDS;
    case 'notifications':
      return DEMO_NOTIFICATIONS;
    default:
      return null;
  }
}

// Проверка является ли пользователь демо-пользователем
export function isDemoUser(userMode: string): boolean {
  return userMode === 'DEMO';
}

// Функция для генерации случайных демо-данных (если нужно)
export function generateRandomDemoData() {
  return {
    totalEmissions: Math.floor(Math.random() * 500) + 1000,
    documentsCount: Math.floor(Math.random() * 50) + 50,
    reportsCount: Math.floor(Math.random() * 20) + 10,
    processingTime: Math.floor(Math.random() * 100) + 100
  };
}