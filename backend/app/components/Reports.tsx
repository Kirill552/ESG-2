import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { Layout } from './Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Alert, AlertDescription } from './ui/alert';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';
import { OrganizationDataForm } from './OrganizationDataForm';
import { ValidationModal } from './ValidationModal';
import { toast } from 'sonner';

// Динамический импорт ReportViewer только на клиенте (избегаем SSR ошибок с PDF.js)
const ReportViewer = dynamic(() => import('./ReportViewer').then(mod => ({ default: mod.ReportViewer })), {
  ssr: false,
  loading: () => <div className="flex items-center justify-center p-8">Загрузка просмотра отчета...</div>
});
import {
  Plus,
  Download,
  Eye,
  Edit3,
  Trash2,
  FileText,
  Calendar,
  CheckCircle,
  Clock,
  AlertTriangle,
  Filter,
  AlertCircle,
  Loader2
} from 'lucide-react';

type Page = 'dashboard' | 'analytics' | 'documents' | 'reports' | 'settings' | 'pricing';

interface ReportsProps {
  onNavigate: (page: Page) => void;
  onLogout: () => void;
}

interface Report {
  id: string;
  name: string;
  type: string;
  period: string;
  status: 'draft' | 'ready' | 'submitted' | 'approved';
  createdDate: string;
  submissionDeadline: string;
  totalEmissions: number;
  documentCount: number;
}

export function Reports({ onNavigate, onLogout }: ReportsProps) {
  const [statusFilter, setStatusFilter] = useState('all');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [reports, setReports] = useState<Report[]>([]);
  const [stats, setStats] = useState({
    total: 0,
    ready_to_send: 0,
    close_deadlines: 0,
    approved: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Состояния для формы создания отчета
  const [reportName, setReportName] = useState('');
  const [reportType, setReportType] = useState('annual');
  const [reportPeriod, setReportPeriod] = useState('2024');
  const [reportFormat, setReportFormat] = useState<'pdf' | 'xml'>('pdf');
  const [reportDescription, setReportDescription] = useState('');
  const [creating, setCreating] = useState(false);
  const [validationError, setValidationError] = useState<{
    message: string;
    missingFields?: string[];
    warnings?: string[];
  } | null>(null);
  const [showMissingFieldsForm, setShowMissingFieldsForm] = useState(false);
  const [isValidationModalOpen, setIsValidationModalOpen] = useState(false);
  const [viewerState, setViewerState] = useState<{
    isOpen: boolean;
    reportId: string;
    reportName: string;
    reportFormat: 'pdf' | 'xml';
  } | null>(null);

  // Загрузка отчетов и статистики
  useEffect(() => {
    fetchReportsData();
  }, [statusFilter]);

  const fetchReportsData = async () => {
    try {
      setLoading(true);

      // Загружаем отчеты и статистику параллельно
      const [reportsResponse, statsResponse] = await Promise.all([
        fetch(`/api/reports?status=${statusFilter}&page=1&pageSize=50`),
        fetch('/api/reports/stats')
      ]);

      if (!reportsResponse.ok || !statsResponse.ok) {
        throw new Error('Failed to fetch data');
      }

      const reportsData = await reportsResponse.json();
      const statsData = await statsResponse.json();

      if (reportsData.reports) {
        setReports(reportsData.reports);
      } else {
        // Поддержка демо-режима - данные возвращаются напрямую
        setReports(reportsData);
      }

      setStats(statsData);
      setError(null);
    } catch (err) {
      console.error('Error fetching reports:', err);
      setError('Ошибка загрузки отчетов');
    } finally {
      setLoading(false);
    }
  };

  // Просмотр отчета
  const handleViewReport = async (report: Report) => {
    setViewerState({
      isOpen: true,
      reportId: report.id,
      reportName: report.name,
      reportFormat: 'pdf' // TODO: получать из report.format
    });
  };

  // Скачивание отчета
  const handleDownloadReport = async (report: Report) => {
    try {
      const response = await fetch(`/api/reports/${report.id}/download`);

      if (!response.ok) {
        throw new Error('Не удалось скачать отчет');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${report.name}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      // Показываем toast-уведомление об успехе
      toast.success('Отчёт скачан', {
        description: `Файл "${report.name}.pdf" сохранён на ваш компьютер`,
        duration: 3000,
      });
    } catch (err) {
      console.error('Error downloading report:', err);
      toast.error('Ошибка при скачивании отчета', {
        description: 'Не удалось скачать файл. Попробуйте ещё раз',
      });
    }
  };

  // Удаление отчета
  const handleDeleteReport = async (report: Report) => {
    if (!confirm(`Вы уверены, что хотите удалить отчёт "${report.name}"?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/reports/${report.id}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        throw new Error('Не удалось удалить отчёт');
      }

      // Перезагружаем список отчётов
      fetchReportsData();

      // Показываем toast-уведомление об успехе
      toast.success('Отчёт успешно удалён', {
        description: `Отчёт "${report.name}" удалён из системы`,
        duration: 3000,
      });
    } catch (error) {
      console.error('Ошибка при удалении отчёта:', error);
      toast.error('Ошибка при удалении отчёта', {
        description: 'Не удалось удалить отчёт. Попробуйте ещё раз',
      });
    }
  };

  // Редактирование отчета - переход на отдельную страницу
  const handleEditReport = (report: Report) => {
    window.location.href = `/reports/${report.id}/edit`;
  };

  // Открываем ValidationModal перед созданием отчета
  const handleInitiateReportCreation = () => {
    setIsValidationModalOpen(true);
  };

  // Фактическое создание отчета (после успешной валидации)
  const handleCreateReport = async () => {
    try {
      setCreating(true);
      setValidationError(null);

      const formData = {
        name: reportName || `Отчет 296-ФЗ за ${reportPeriod}`,
        reportType,
        period: reportPeriod,
        format: reportFormat,
        description: reportDescription,
      };

      const response = await fetch('/api/reports', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const errorData = await response.json();

        // Проверка на ошибку неполных данных организации
        if (errorData.error === 'ORGANIZATION_INCOMPLETE') {
          setValidationError({
            message: errorData.message || 'Необходимо дополнить данные организации',
            missingFields: errorData.missingFields || [],
            warnings: errorData.warnings || [],
          });
          setShowMissingFieldsForm(true);
          return;
        }

        throw new Error(errorData.error || 'Failed to create report');
      }

      const newReport = await response.json();
      setReports(prev => [newReport, ...prev]);
      setIsCreateDialogOpen(false);
      resetForm();

      toast.success('Отчёт успешно создан', {
        description: `Отчёт "${newReport.name}" готов к работе`,
        duration: 3000,
      });

      // Обновляем статистику
      fetchReportsData();
    } catch (err) {
      console.error('Error creating report:', err);
      setError(err instanceof Error ? err.message : 'Ошибка создания отчета');
      toast.error('Ошибка создания отчета', {
        description: err instanceof Error ? err.message : 'Попробуйте ещё раз',
      });
    } finally {
      setCreating(false);
    }
  };

  const resetForm = () => {
    setReportName('');
    setReportType('annual');
    setReportPeriod('2024');
    setReportFormat('pdf');
    setReportDescription('');
    setValidationError(null);
    setShowMissingFieldsForm(false);
  };

  const handleCloseDialog = () => {
    setIsCreateDialogOpen(false);
    resetForm();
  };

  const filteredReports = reports.filter(report => 
    statusFilter === 'all' || report.status === statusFilter
  );

  const getStatusBadge = (status: Report['status']) => {
    switch (status) {
      case 'draft':
        return <Badge variant="outline">Черновик</Badge>;
      case 'ready':
        return <Badge variant="default" className="bg-green-100 text-green-800 border-green-200">Готов</Badge>;
      // Скрыто для MVP:
      // case 'submitted':
      //   return <Badge variant="secondary">Отправлен</Badge>;
      // case 'approved':
      //   return <Badge variant="default" className="bg-green-100 text-green-800 border-green-200">Утвержден</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getStatusIcon = (status: Report['status']) => {
    switch (status) {
      case 'draft':
        return <Edit3 className="w-4 h-4 text-muted-foreground" />;
      case 'ready':
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      // Скрыто для MVP:
      // case 'submitted':
      //   return <Clock className="w-4 h-4 text-orange-600" />;
      // case 'approved':
      //   return <CheckCircle className="w-4 h-4 text-green-600" />;
      default:
        return <FileText className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const isDeadlineNear = (deadline: string) => {
    const deadlineDate = new Date(deadline.split('.').reverse().join('-'));
    const today = new Date();
    const diffTime = deadlineDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays <= 30 && diffDays > 0;
  };

  const isOverdue = (deadline: string) => {
    const deadlineDate = new Date(deadline.split('.').reverse().join('-'));
    const today = new Date();
    return deadlineDate < today;
  };

  return (
    <Layout currentPage="reports" onNavigate={onNavigate} onLogout={onLogout}>
      <div className="flex-1 overflow-auto bg-[#fcfdfc]">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gray-50 rounded-xl flex items-center justify-center border border-gray-100">
                <FileText className="w-6 h-6 text-[#1dc962]" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Отчеты</h1>
                <p className="text-[#58625d]">
                  Создание и управление отчетами
                </p>
              </div>
            </div>
            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button className="bg-[#1dc962] hover:bg-[#1dc962]/90 text-white">
                  <Plus className="w-4 h-4 mr-2" />
                  Создать отчет
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Создание нового отчета</DialogTitle>
                  <DialogDescription>
                    Выберите тип отчета и период для автоматического создания
                  </DialogDescription>
                </DialogHeader>

                {/* Ошибка валидации данных организации */}
                {validationError && (
                  <Alert variant="destructive" className="mt-4">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      <div className="font-semibold mb-2">{validationError.message}</div>
                      {validationError.missingFields && validationError.missingFields.length > 0 && (
                        <div className="mt-2">
                          <div className="text-sm font-medium mb-1">Не заполнены обязательные поля:</div>
                          <ul className="list-disc list-inside text-sm space-y-1">
                            {validationError.missingFields.map((field, index) => (
                              <li key={index}>{field}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {validationError.warnings && validationError.warnings.length > 0 && (
                        <div className="mt-2">
                          <div className="text-sm font-medium mb-1">Рекомендации:</div>
                          <ul className="list-disc list-inside text-sm space-y-1">
                            {validationError.warnings.map((warning, index) => (
                              <li key={index}>{warning}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      <div className="mt-3 pt-3 border-t">
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full"
                          onClick={() => {
                            onNavigate('settings');
                            handleCloseDialog();
                          }}
                        >
                          Перейти в Настройки → Организация
                        </Button>
                      </div>
                    </AlertDescription>
                  </Alert>
                )}

                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="report-name">Название отчета</Label>
                    <Input
                      id="report-name"
                      placeholder="Введите название отчета"
                      value={reportName}
                      onChange={(e) => setReportName(e.target.value)}
                      disabled={creating}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="report-type">Тип отчета</Label>
                      <Select value={reportType} onValueChange={setReportType} disabled={creating}>
                        <SelectTrigger>
                          <SelectValue placeholder="Выберите тип" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="annual">296-ФЗ Годовой</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="report-period">Отчетный период</Label>
                      <Select value={reportPeriod} onValueChange={setReportPeriod} disabled={creating}>
                        <SelectTrigger>
                          <SelectValue placeholder="Выберите период" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="2025">2025 год</SelectItem>
                          <SelectItem value="2024">2024 год</SelectItem>
                          <SelectItem value="2023">2023 год</SelectItem>
                          <SelectItem value="2022">2022 год</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Выбор формата отчета */}
                  <div className="space-y-2">
                    <Label>Формат отчета</Label>
                    <RadioGroup
                      value={reportFormat}
                      onValueChange={(value) => setReportFormat(value as 'pdf' | 'xml')}
                      disabled={creating}
                      className="grid grid-cols-2 gap-4"
                    >
                      <div className="relative">
                        <RadioGroupItem value="pdf" id="format-pdf" className="peer sr-only" />
                        <Label
                          htmlFor="format-pdf"
                          className={`flex flex-col items-center justify-between rounded-lg border-2 p-4 cursor-pointer transition-all ${
                            reportFormat === 'pdf'
                              ? 'border-[#1dc962] bg-[#1dc962]/5 shadow-sm'
                              : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
                          }`}
                        >
                          <FileText className={`mb-2 h-6 w-6 ${reportFormat === 'pdf' ? 'text-[#1dc962]' : 'text-gray-400'}`} />
                          <div className="text-center">
                            <div className={`font-semibold ${reportFormat === 'pdf' ? 'text-[#1dc962]' : 'text-gray-900'}`}>PDF</div>
                            <div className="text-xs text-gray-500 mt-1">
                              Удобный для печати и отправки
                            </div>
                          </div>
                        </Label>
                      </div>

                      <div className="relative">
                        <RadioGroupItem value="xml" id="format-xml" className="peer sr-only" />
                        <Label
                          htmlFor="format-xml"
                          className={`flex flex-col items-center justify-between rounded-lg border-2 p-4 cursor-pointer transition-all ${
                            reportFormat === 'xml'
                              ? 'border-[#1dc962] bg-[#1dc962]/5 shadow-sm'
                              : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
                          }`}
                        >
                          <FileText className={`mb-2 h-6 w-6 ${reportFormat === 'xml' ? 'text-[#1dc962]' : 'text-gray-400'}`} />
                          <div className="text-center">
                            <div className={`font-semibold ${reportFormat === 'xml' ? 'text-[#1dc962]' : 'text-gray-900'}`}>XML</div>
                            <div className="text-xs text-gray-500 mt-1">
                              Для подачи в Росприроднадзор
                            </div>
                          </div>
                        </Label>
                      </div>
                    </RadioGroup>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description">Описание (опционально)</Label>
                    <Textarea
                      id="description"
                      placeholder="Дополнительные комментарии к отчету"
                      rows={3}
                      value={reportDescription}
                      onChange={(e) => setReportDescription(e.target.value)}
                      disabled={creating}
                    />
                  </div>
                </div>

                <div className="flex justify-end space-x-2 pt-4 border-t">
                  <Button variant="outline" onClick={handleCloseDialog} disabled={creating}>
                    Отмена
                  </Button>
                  <Button
                    onClick={handleInitiateReportCreation}
                    disabled={creating || !reportPeriod}
                    className="bg-[#1dc962] hover:bg-[#1dc962]/90"
                  >
                    {creating ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Создание...
                      </>
                    ) : (
                      'Создать отчет'
                    )}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

            {/* Форма заполнения недостающих данных организации */}
            <OrganizationDataForm
              isOpen={showMissingFieldsForm}
              onClose={() => setShowMissingFieldsForm(false)}
              onSuccess={() => {
                // После успешного сохранения пробуем создать отчет снова
                handleCreateReport();
              }}
              missingFields={validationError?.missingFields}
              warnings={validationError?.warnings}
            />
          </div>

          {/* Stats - упрощенная версия для MVP */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-2xl font-semibold">{loading ? '...' : stats.total}</div>
                    <div className="text-sm text-muted-foreground">Всего отчетов</div>
                  </div>
                  <FileText className="w-8 h-8 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-2xl font-semibold text-green-600">
                      {loading ? '...' : stats.ready_to_send}
                    </div>
                    <div className="text-sm text-muted-foreground">Готовы к работе</div>
                  </div>
                  <CheckCircle className="w-8 h-8 text-green-600" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-2xl font-semibold text-orange-600">
                      {loading ? '...' : stats.close_deadlines}
                    </div>
                    <div className="text-sm text-muted-foreground">Близкие дедлайны</div>
                  </div>
                  <AlertTriangle className="w-8 h-8 text-orange-600" />
                </div>
              </CardContent>
            </Card>
            {/* Скрыто для MVP (отправка в регулятор): */}
            {/* <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-2xl font-semibold text-green-600">
                      {loading ? '...' : stats.approved}
                    </div>
                    <div className="text-sm text-muted-foreground">Утверждены</div>
                  </div>
                  <CheckCircle className="w-8 h-8 text-green-600" />
                </div>
              </CardContent>
            </Card> */}
          </div>

          {/* Filters */}
          <Card className="mb-6">
            <CardContent className="p-4">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4 text-muted-foreground" />
                  <Label htmlFor="status-filter">Статус:</Label>
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Все статусы</SelectItem>
                    <SelectItem value="draft">Черновик</SelectItem>
                    <SelectItem value="ready">Готов</SelectItem>
                    {/* Скрыто для MVP: */}
                    {/* <SelectItem value="submitted">Отправлен</SelectItem> */}
                    {/* <SelectItem value="approved">Утвержден</SelectItem> */}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Error Message */}
          {error && (
            <Card className="mb-6">
              <CardContent className="p-4">
                <div className="text-red-600 text-center">{error}</div>
              </CardContent>
            </Card>
          )}

          {/* Reports Table */}
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Отчет</TableHead>
                    <TableHead>Тип</TableHead>
                    <TableHead>Статус</TableHead>
                    <TableHead>Выбросы</TableHead>
                    <TableHead>Документы</TableHead>
                    <TableHead>Дедлайн</TableHead>
                    <TableHead>Действия</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8">
                        Загрузка отчетов...
                      </TableCell>
                    </TableRow>
                  ) : filteredReports.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        <div className="space-y-2">
                          <div className="text-base font-medium">Отчеты не найдены</div>
                          <div className="text-sm">
                            {statusFilter === 'all' ? (
                              <>
                                У вас пока нет созданных отчетов.<br/>
                                Нажмите кнопку <strong>"Создать отчет"</strong> чтобы начать.
                              </>
                            ) : (
                              <>
                                Нет отчетов со статусом "{statusFilter === 'draft' ? 'Черновик' : 'Готов'}".<br/>
                                Попробуйте изменить фильтр или создать новый отчет.
                              </>
                            )}
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredReports.map((report) => (
                    <TableRow key={report.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{report.name}</div>
                          <div className="text-sm text-muted-foreground">
                            Создан: {report.createdDate}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{report.type}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getStatusIcon(report.status)}
                          {getStatusBadge(report.status)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{report.totalEmissions} тСО₂</div>
                      </TableCell>
                      <TableCell>
                        <div className="text-muted-foreground">{report.documentCount} файлов</div>
                      </TableCell>
                      <TableCell>
                        <div className={`flex items-center gap-2 ${
                          isOverdue(report.submissionDeadline) 
                            ? 'text-red-600' 
                            : isDeadlineNear(report.submissionDeadline) 
                              ? 'text-orange-600' 
                              : 'text-muted-foreground'
                        }`}>
                          <Calendar className="w-4 h-4" />
                          {report.submissionDeadline}
                          {isOverdue(report.submissionDeadline) && (
                            <Badge variant="destructive" className="ml-1">Просрочен</Badge>
                          )}
                          {isDeadlineNear(report.submissionDeadline) && !isOverdue(report.submissionDeadline) && (
                            <Badge variant="outline" className="ml-1 border-orange-200 text-orange-600">Скоро</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleViewReport(report)}
                            title="Просмотр отчета"
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDownloadReport(report)}
                            title="Скачать отчет"
                          >
                            <Download className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditReport(report)}
                            title="Редактировать отчет"
                          >
                            <Edit3 className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteReport(report)}
                            title="Удалить отчет"
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Upcoming Deadlines */}
          <Card className="mt-8">
            <CardHeader>
              <CardTitle>Ближайшие дедлайны</CardTitle>
              <CardDescription>
                Отчеты, которые необходимо подготовить в ближайшее время
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 border border-orange-200 rounded-lg bg-orange-50">
                  <div className="flex items-center gap-3">
                    <AlertTriangle className="w-5 h-5 text-orange-600" />
                    <div>
                      <div className="font-medium">Годовой отчет о выбросах ПГ 2025</div>
                      <div className="text-sm text-muted-foreground">Дедлайн: 1 июля 2026</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="border-orange-200 text-orange-600">
                      {(() => {
                        const deadline = new Date('2026-07-01');
                        const today = new Date();
                        const diffTime = deadline.getTime() - today.getTime();
                        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                        return diffDays > 0 ? `${diffDays} дн${diffDays === 1 ? 'ь' : diffDays < 5 ? 'я' : 'ей'} осталось` : 'Просрочен';
                      })()}
                    </Badge>
                    <Button size="sm">Завершить</Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Validation Modal */}
      <ValidationModal
        isOpen={isValidationModalOpen}
        onClose={() => setIsValidationModalOpen(false)}
        onContinue={handleCreateReport}
        onNavigateToSettings={(url) => {
          onNavigate('settings');
          setIsValidationModalOpen(false);
        }}
      />

      {/* Report Viewer/Editor */}
      {viewerState?.isOpen && (
        <ReportViewer
          reportId={viewerState.reportId}
          reportName={viewerState.reportName}
          reportFormat={viewerState.reportFormat}
          onClose={() => {
            setViewerState(null);
            fetchReportsData(); // Обновляем список после закрытия
          }}
        />
      )}
    </Layout>
  );
}