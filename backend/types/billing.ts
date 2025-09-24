// Типы для банковских счетов и платежной системы

export interface BankInvoice {
  id: string;
  organizationId: string;
  invoiceNumber: string;
  bankInvoiceId: string;
  invoiceType: 'PLAN_PURCHASE' | 'OVERAGE_PAYMENT';
  planType?: 'STARTER' | 'PROFESSIONAL' | 'ENTERPRISE';
  amount: number;
  currency: string;
  status: 'PENDING' | 'PAID' | 'CANCELLED' | 'EXPIRED';
  customerName: string;
  customerInn: string;
  customerAddress?: string;
  customerPhone?: string;
  customerEmail?: string;
  paymentUrl?: string;
  qrCodeUrl?: string;
  pdfUrl?: string;
  description: string;
  estimatedEmissions?: number;
  excessEmissions?: number;
  ratePerTon?: number;
  expirationDate?: Date;
  paidAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface EmissionOveragePayment {
  id: string;
  organizationId: string;
  reportId: string;
  bankInvoiceId: string;
  excessEmissions: number;
  ratePerTon: number;
  totalAmount: number;
  status: 'PENDING' | 'PAID' | 'CANCELLED';
  paidAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface InvoiceFilters {
  status?: 'all' | 'PENDING' | 'PAID' | 'CANCELLED' | 'EXPIRED';
  type?: 'all' | 'PLAN_PURCHASE' | 'OVERAGE_PAYMENT';
  planType?: 'all' | 'STARTER' | 'PROFESSIONAL' | 'ENTERPRISE';
  dateFrom?: string;
  dateTo?: string;
  search?: string;
}

export interface InvoicePagination {
  page: number;
  limit: number;
  totalCount: number;
  totalPages: number;
}

export interface InvoiceListResponse {
  invoices: BankInvoice[];
  pagination: InvoicePagination;
  statistics: InvoiceStatistics;
}

export interface InvoiceStatistics {
  total: number;
  pending: number;
  paid: number;
  cancelled: number;
  expired: number;
  totalAmount: number;
}

// Типы для Банк Точка API

export interface BankTochkaInvoiceRequest {
  amount: number;
  currency: string;
  description: string;
  customer: {
    name: string;
    inn: string;
    address?: string;
    phone?: string;
    email?: string;
  };
  expirationDate?: string;
  metadata?: Record<string, any>;
}

export interface BankTochkaInvoiceResponse {
  id: string;
  status: 'PENDING' | 'PAID' | 'CANCELLED' | 'EXPIRED';
  amount: number;
  currency: string;
  paymentUrl: string;
  qrCodeUrl: string;
  pdfUrl: string;
  expirationDate: string;
  createdAt: string;
  updatedAt: string;
}

export interface BankTochkaWebhook {
  id: string;
  event: 'payment.succeeded' | 'payment.failed' | 'payment.cancelled';
  data: {
    invoiceId: string;
    amount: number;
    currency: string;
    status: string;
    paidAt?: string;
    metadata?: Record<string, any>;
  };
  timestamp: string;
}

export interface PaymentStatus {
  status: 'PENDING' | 'PAID' | 'CANCELLED' | 'EXPIRED';
  paidAt?: string;
  amount?: number;
  currency?: string;
}

// Типы для EDO интеграции

export interface EdoDocument {
  id: string;
  type: 'UPD' | 'INVOICE' | 'ACT';
  status: 'DRAFT' | 'SENT' | 'DELIVERED' | 'SIGNED';
  documentNumber: string;
  amount: number;
  createdAt: Date;
  signedAt?: Date;
  deliveredAt?: Date;
}

export interface UploadedDocument {
  id: string;
  fileName: string;
  fileSize: number;
  contentType: string;
  uploadedAt: Date;
}

// Утилиты для работы с типами

export function getInvoiceStatusColor(status: BankInvoice['status']): string {
  switch (status) {
    case 'PENDING':
      return 'text-amber-600 bg-amber-50 dark:bg-amber-950/20';
    case 'PAID':
      return 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/20';
    case 'CANCELLED':
      return 'text-red-600 bg-red-50 dark:bg-red-950/20';
    case 'EXPIRED':
      return 'text-orange-600 bg-orange-50 dark:bg-orange-950/20';
    default:
      return 'text-gray-600 bg-gray-50 dark:bg-gray-950/20';
  }
}

export function getInvoiceStatusText(status: BankInvoice['status']): string {
  switch (status) {
    case 'PENDING':
      return 'Ожидает оплаты';
    case 'PAID':
      return 'Оплачен';
    case 'CANCELLED':
      return 'Отменен';
    case 'EXPIRED':
      return 'Просрочен';
    default:
      return 'Неизвестно';
  }
}

export function getInvoiceTypeText(type: BankInvoice['invoiceType']): string {
  switch (type) {
    case 'PLAN_PURCHASE':
      return 'Покупка тарифа';
    case 'OVERAGE_PAYMENT':
      return 'Доплата за превышение';
    default:
      return 'Неизвестно';
  }
}

export function formatCurrency(amount: number, currency = 'RUB'): string {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  }).format(amount);
}
