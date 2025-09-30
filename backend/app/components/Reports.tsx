import React, { useState, useEffect } from 'react';
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
import { 
  Plus, 
  Download, 
  Eye, 
  Edit3, 
  FileText, 
  Calendar,
  CheckCircle,
  Clock,
  AlertTriangle,
  Filter
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

  const createReport = async (formData: any) => {
    try {
      const response = await fetch('/api/reports', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create report');
      }

      const newReport = await response.json();
      setReports(prev => [newReport, ...prev]);
      setIsCreateDialogOpen(false);

      // Обновляем статистику
      fetchReportsData();
    } catch (err) {
      console.error('Error creating report:', err);
      setError(err instanceof Error ? err.message : 'Ошибка создания отчета');
    }
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
              <DialogContent className="sm:max-w-[600px]">
                <DialogHeader>
                  <DialogTitle>Создание нового отчета</DialogTitle>
                  <DialogDescription>
                    Выберите тип отчета и период для автоматического создания
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="report-name">Название отчета</Label>
                    <Input id="report-name" placeholder="Введите название отчета" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="report-type">Тип отчета</Label>
                      <Select>
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
                      <Select>
                        <SelectTrigger>
                          <SelectValue placeholder="Выберите период" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="2024">2024 год</SelectItem>
                          <SelectItem value="2023">2023 год</SelectItem>
                          <SelectItem value="2022">2022 год</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="description">Описание (опционально)</Label>
                    <Textarea 
                      id="description" 
                      placeholder="Дополнительные комментарии к отчету"
                      rows={3}
                    />
                  </div>
                </div>
                <div className="flex justify-end space-x-2">
                  <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                    Отмена
                  </Button>
                  <Button
                    onClick={() => {
                      // В реальном приложении здесь была бы обработка формы
                      const formData = {
                        name: "Новый отчет 296-ФЗ",
                        reportType: "annual",
                        period: "2024",
                        description: ""
                      };
                      createReport(formData);
                    }}
                  >
                    Создать отчет
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
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
                          <Button variant="ghost" size="sm">
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="sm">
                            <Download className="w-4 h-4" />
                          </Button>
                          {report.status === 'draft' && (
                            <Button variant="ghost" size="sm">
                              <Edit3 className="w-4 h-4" />
                            </Button>
                          )}
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
                      <div className="font-medium">Годовой отчет о выбросах ПГ 2024</div>
                      <div className="text-sm text-muted-foreground">Дедлайн: 31 марта 2025</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="border-orange-200 text-orange-600">
                      94 дня осталось
                    </Badge>
                    <Button size="sm">Завершить</Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}