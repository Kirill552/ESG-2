'use client';

import { use, useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Textarea } from '@/app/components/ui/textarea';
import { Label } from '@/app/components/ui/label';
import { ArrowLeft, Save, Download, Loader2, Plus, Trash2, AlertCircle } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/app/components/ui/tabs';

interface ReportEditPageProps {
  params: Promise<{ id: string }>;
}

interface ValidationError {
  field: string;
  message: string;
}

interface OrganizationData {
  name: string;
  legalForm: string;
  ogrn: string;
  inn: string;
  okpo: string;
  oktmo: string;
  okved: string;
  address: string;
  email: string;
  phone: string;
  reportBasis: string;
  executor: string;
}

interface EmissionEntry {
  gasType: string;
  mass: number;
  gwp: number;
  co2Equivalent: number;
  percentage: number;
}

interface ProcessEntry {
  code: string;
  description: string;
  nvosCode: string;
  capacity: number;
  unit: string;
}

interface MethodEntry {
  processCode: string;
  method: string;
  emissionFactorSource: string;
  justification: string;
}

export default function ReportEditPage({ params }: ReportEditPageProps) {
  const resolvedParams = use(params);
  const reportId = resolvedParams.id;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [report, setReport] = useState<any>(null);
  const [errors, setErrors] = useState<ValidationError[]>([]);

  // Секция 1: Реквизиты организации
  const [organization, setOrganization] = useState<OrganizationData>({
    name: '',
    legalForm: 'ООО',
    ogrn: '',
    inn: '',
    okpo: '',
    oktmo: '',
    okved: '',
    address: '',
    email: '',
    phone: '',
    reportBasis: '296-ФЗ от 02.07.2021',
    executor: ''
  });

  // Секция 2: Процессы и объекты
  const [processes, setProcesses] = useState<ProcessEntry[]>([
    { code: '1', description: '', nvosCode: '', capacity: 0, unit: 'т/год' }
  ]);

  // Секция 3: Выбросы ПГ
  const [emissions, setEmissions] = useState<EmissionEntry[]>([
    { gasType: 'CO₂', mass: 0, gwp: 1, co2Equivalent: 0, percentage: 0 },
    { gasType: 'CH₄', mass: 0, gwp: 28, co2Equivalent: 0, percentage: 0 },
    { gasType: 'N₂O', mass: 0, gwp: 265, co2Equivalent: 0, percentage: 0 }
  ]);

  // Секция 4: Методы определения
  const [methods, setMethods] = useState<MethodEntry[]>([
    { processCode: '1', method: 'Расчетный метод', emissionFactorSource: '', justification: '' }
  ]);

  // Метаданные отчета
  const [reportName, setReportName] = useState('');
  const [reportPeriod, setReportPeriod] = useState('2025');
  const [reportNotes, setReportNotes] = useState('');

  useEffect(() => {
    loadReport();
  }, [reportId]);

  // Пересчет выбросов при изменении
  useEffect(() => {
    recalculateEmissions();
  }, [emissions]);

  const loadReport = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/reports/${reportId}`);

      if (!response.ok) {
        throw new Error('Не удалось загрузить отчёт');
      }

      const data = await response.json();
      setReport(data);
      setReportName(data.name || '');
      setReportPeriod(data.period || '2025');
      setReportNotes(data.notes || '');

      // Загружаем данные организации из emissionData или из настроек пользователя
      const orgData = data.emissionData?.organizationData || data.documents?.[0]?.organization;

      // Если нет данных в отчете, загружаем из settings
      if (!orgData || !orgData.name) {
        try {
          const orgResponse = await fetch('/api/settings/organization');
          if (orgResponse.ok) {
            const orgResult = await orgResponse.json();
            if (orgResult.ok && orgResult.organization) {
              const org = orgResult.organization;
              setOrganization({
                name: org.name || '',
                legalForm: 'ООО', // TODO: добавить в БД
                ogrn: org.ogrn || '',
                inn: org.inn || '',
                okpo: org.okpo || '',
                oktmo: org.oktmo || '',
                okved: org.okved || '',
                address: org.legalAddress || org.address || '',
                email: org.email || '',
                phone: org.phone || '',
                reportBasis: data.methodology || '296-ФЗ от 02.07.2021',
                executor: org.directorName || ''
              });
            }
          }
        } catch (error) {
          console.error('Ошибка загрузки данных организации:', error);
        }
      } else {
        setOrganization({
          name: orgData.name || '',
          legalForm: orgData.legalForm || 'ООО',
          ogrn: orgData.ogrn || '',
          inn: orgData.inn || '',
          okpo: orgData.okpo || '',
          oktmo: orgData.oktmo || '',
          okved: orgData.okved || '',
          address: orgData.address || '',
          email: orgData.email || '',
          phone: orgData.phone || '',
          reportBasis: orgData.reportBasis || data.methodology || '296-ФЗ от 02.07.2021',
          executor: orgData.executor || ''
        });
      }

      // Загружаем данные о выбросах
      if (data.emissionData) {
        // Если есть детальные данные в emissionData.details, используем их
        if (data.emissionData.details?.emissions && Array.isArray(data.emissionData.details.emissions)) {
          setEmissions(data.emissionData.details.emissions);
        } else {
          // Иначе используем scope1/scope2/scope3
          const scope1 = data.emissionData.scope1 || 0;
          const scope2 = data.emissionData.scope2 || 0;
          const scope3 = data.emissionData.scope3 || 0;

          setEmissions([
            {
              gasType: 'CO₂',
              mass: scope1 / 1, // GWP = 1
              gwp: 1,
              co2Equivalent: scope1,
              percentage: 0
            },
            {
              gasType: 'CH₄',
              mass: scope2 / 28, // GWP = 28
              gwp: 28,
              co2Equivalent: scope2,
              percentage: 0
            },
            {
              gasType: 'N₂O',
              mass: scope3 / 265, // GWP = 265
              gwp: 265,
              co2Equivalent: scope3,
              percentage: 0
            }
          ]);
        }

        // Загружаем процессы если есть
        if (data.emissionData.details?.processes && Array.isArray(data.emissionData.details.processes)) {
          setProcesses(data.emissionData.details.processes);
        }

        // Загружаем методы если есть
        if (data.emissionData.details?.methods && Array.isArray(data.emissionData.details.methods)) {
          setMethods(data.emissionData.details.methods);
        }
      }

    } catch (error) {
      console.error('Ошибка загрузки отчёта:', error);
      alert('Не удалось загрузить отчёт');
    } finally {
      setLoading(false);
    }
  };

  const recalculateEmissions = () => {
    const totalEmissions = emissions.reduce((sum, e) => sum + e.co2Equivalent, 0);

    const updatedEmissions = emissions.map(e => ({
      ...e,
      co2Equivalent: e.mass * e.gwp,
      percentage: totalEmissions > 0 ? (e.mass * e.gwp / totalEmissions) * 100 : 0
    }));

    if (JSON.stringify(updatedEmissions) !== JSON.stringify(emissions)) {
      setEmissions(updatedEmissions);
    }
  };

  const validateForm = (): boolean => {
    const newErrors: ValidationError[] = [];

    // Валидация организации
    if (!organization.name.trim()) {
      newErrors.push({ field: 'organization.name', message: 'Название организации обязательно' });
    }
    if (!/^\d{10,12}$/.test(organization.inn)) {
      newErrors.push({ field: 'organization.inn', message: 'ИНН должен содержать 10-12 цифр' });
    }
    if (organization.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(organization.email)) {
      newErrors.push({ field: 'organization.email', message: 'Некорректный email' });
    }

    // Валидация выбросов
    emissions.forEach((e, i) => {
      if (e.mass < 0) {
        newErrors.push({ field: `emissions.${i}.mass`, message: `Масса ${e.gasType} не может быть отрицательной` });
      }
    });

    setErrors(newErrors);
    return newErrors.length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) {
      alert('❌ Пожалуйста, исправьте ошибки в форме');
      return;
    }

    try {
      setSaving(true);

      const totalEmissions = emissions.reduce((sum, e) => sum + e.co2Equivalent, 0);

      const updateData = {
        name: reportName,
        period: reportPeriod,
        totalEmissions,
        methodology: organization.reportBasis,
        notes: reportNotes,
        emissionData: {
          scope1: emissions[0]?.co2Equivalent || 0,
          scope2: emissions[1]?.co2Equivalent || 0,
          scope3: emissions[2]?.co2Equivalent || 0,
          total: totalEmissions,
          details: {
            emissions: emissions,
            processes: processes,
            methods: methods
          }
        },
        organizationData: organization
      };

      const response = await fetch(`/api/reports/${reportId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData)
      });

      if (!response.ok) {
        throw new Error('Не удалось сохранить изменения');
      }

      alert('✅ Отчёт успешно сохранён!');
      window.location.href = '/?view=reports';
    } catch (error) {
      console.error('Ошибка сохранения:', error);
      alert('❌ Ошибка при сохранении отчёта');
    } finally {
      setSaving(false);
    }
  };

  const handleDownload = async () => {
    try {
      const response = await fetch(`/api/reports/${reportId}/download`);

      if (!response.ok) {
        throw new Error('Не удалось скачать отчёт');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${reportName}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Ошибка скачивания:', error);
      alert('Ошибка при скачивании отчёта');
    }
  };

  // Функции управления процессами
  const addProcess = () => {
    setProcesses([...processes, {
      code: (processes.length + 1).toString(),
      description: '',
      nvosCode: '',
      capacity: 0,
      unit: 'т/год'
    }]);
  };

  const removeProcess = (index: number) => {
    setProcesses(processes.filter((_, i) => i !== index));
  };

  const updateProcess = (index: number, field: keyof ProcessEntry, value: any) => {
    const updated = [...processes];
    updated[index] = { ...updated[index], [field]: value };
    setProcesses(updated);
  };

  // Функции управления выбросами
  const updateEmission = (index: number, field: keyof EmissionEntry, value: any) => {
    const updated = [...emissions];
    updated[index] = { ...updated[index], [field]: value };

    // Автоматический пересчет CO2-эквивалента
    if (field === 'mass' || field === 'gwp') {
      updated[index].co2Equivalent = updated[index].mass * updated[index].gwp;
    }

    setEmissions(updated);
  };

  // Функции управления методами
  const addMethod = () => {
    setMethods([...methods, {
      processCode: (methods.length + 1).toString(),
      method: 'Расчетный метод',
      emissionFactorSource: '',
      justification: ''
    }]);
  };

  const removeMethod = (index: number) => {
    setMethods(methods.filter((_, i) => i !== index));
  };

  const updateMethod = (index: number, field: keyof MethodEntry, value: any) => {
    const updated = [...methods];
    updated[index] = { ...updated[index], [field]: value };
    setMethods(updated);
  };

  const getFieldError = (field: string): string | undefined => {
    return errors.find(e => e.field === field)?.message;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-[#1dc962] mx-auto mb-4" />
          <p className="text-gray-600">Загрузка отчёта...</p>
        </div>
      </div>
    );
  }

  const totalEmissions = emissions.reduce((sum, e) => sum + e.co2Equivalent, 0);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                onClick={() => window.location.href = '/?view=reports'}
                className="gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                Назад к отчётам
              </Button>
              <div className="border-l h-6"></div>
              <h1 className="text-xl font-semibold text-gray-900">
                Редактирование отчёта
              </h1>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={handleDownload}
                className="gap-2"
              >
                <Download className="w-4 h-4" />
                Скачать
              </Button>
              <Button
                onClick={handleSave}
                disabled={saving}
                className="bg-[#1dc962] hover:bg-[#1dc962]/90 gap-2"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Сохранение...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    Сохранить изменения
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Errors Display */}
      {errors.length > 0 && (
        <div className="container mx-auto px-6 py-4">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h3 className="text-sm font-medium text-red-900 mb-2">
                  Обнаружены ошибки валидации:
                </h3>
                <ul className="text-sm text-red-700 space-y-1 list-disc list-inside">
                  {errors.map((error, i) => (
                    <li key={i}>{error.message}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="container mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Левая колонка - Редактор */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>Редактирование данных отчёта 296-ФЗ</CardTitle>
                <p className="text-sm text-gray-500 mt-2">
                  Все изменения сохраняются при нажатии кнопки "Сохранить изменения"
                </p>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="general" className="w-full">
                  <TabsList className="grid w-full grid-cols-5">
                    <TabsTrigger value="general">Общие</TabsTrigger>
                    <TabsTrigger value="organization">Организация</TabsTrigger>
                    <TabsTrigger value="processes">Процессы</TabsTrigger>
                    <TabsTrigger value="emissions">Выбросы</TabsTrigger>
                    <TabsTrigger value="methods">Методы</TabsTrigger>
                  </TabsList>

                  {/* Общая информация */}
                  <TabsContent value="general" className="space-y-4 mt-4">
                    <div className="space-y-2">
                      <Label htmlFor="reportName">Название отчёта</Label>
                      <Input
                        id="reportName"
                        value={reportName}
                        onChange={(e) => setReportName(e.target.value)}
                        placeholder="Годовой отчет о выбросах ПГ 2025"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="reportPeriod">Отчётный период</Label>
                      <Input
                        id="reportPeriod"
                        value={reportPeriod}
                        onChange={(e) => setReportPeriod(e.target.value)}
                        placeholder="2025"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="reportNotes">Примечания</Label>
                      <Textarea
                        id="reportNotes"
                        value={reportNotes}
                        onChange={(e) => setReportNotes(e.target.value)}
                        rows={4}
                        placeholder="Дополнительные комментарии к отчёту..."
                      />
                    </div>

                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <h4 className="text-sm font-medium text-blue-900 mb-2">
                        Итоговые показатели
                      </h4>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-blue-700">Общие выбросы:</p>
                          <p className="font-semibold text-blue-900">
                            {totalEmissions.toFixed(2)} тСО₂-экв
                          </p>
                        </div>
                        <div>
                          <p className="text-blue-700">Методология:</p>
                          <p className="font-semibold text-blue-900">
                            {organization.reportBasis}
                          </p>
                        </div>
                      </div>
                    </div>
                  </TabsContent>

                  {/* Секция 1: Организация */}
                  <TabsContent value="organization" className="space-y-4 mt-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="org_name">Название организации *</Label>
                        <Input
                          id="org_name"
                          value={organization.name}
                          onChange={(e) => setOrganization({ ...organization, name: e.target.value })}
                          className={getFieldError('organization.name') ? 'border-red-500' : ''}
                        />
                        {getFieldError('organization.name') && (
                          <p className="text-xs text-red-600">{getFieldError('organization.name')}</p>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="org_legalForm">Организационно-правовая форма</Label>
                        <Input
                          id="org_legalForm"
                          value={organization.legalForm}
                          onChange={(e) => setOrganization({ ...organization, legalForm: e.target.value })}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="org_inn">ИНН *</Label>
                        <Input
                          id="org_inn"
                          value={organization.inn}
                          onChange={(e) => setOrganization({ ...organization, inn: e.target.value })}
                          maxLength={12}
                          className={getFieldError('organization.inn') ? 'border-red-500' : ''}
                        />
                        {getFieldError('organization.inn') && (
                          <p className="text-xs text-red-600">{getFieldError('organization.inn')}</p>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="org_ogrn">ОГРН</Label>
                        <Input
                          id="org_ogrn"
                          value={organization.ogrn}
                          onChange={(e) => setOrganization({ ...organization, ogrn: e.target.value })}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="org_okpo">ОКПО</Label>
                        <Input
                          id="org_okpo"
                          value={organization.okpo}
                          onChange={(e) => setOrganization({ ...organization, okpo: e.target.value })}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="org_oktmo">ОКТМО</Label>
                        <Input
                          id="org_oktmo"
                          value={organization.oktmo}
                          onChange={(e) => setOrganization({ ...organization, oktmo: e.target.value })}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="org_okved">ОКВЭД</Label>
                        <Input
                          id="org_okved"
                          value={organization.okved}
                          onChange={(e) => setOrganization({ ...organization, okved: e.target.value })}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="org_email">Email</Label>
                        <Input
                          id="org_email"
                          type="email"
                          value={organization.email}
                          onChange={(e) => setOrganization({ ...organization, email: e.target.value })}
                          className={getFieldError('organization.email') ? 'border-red-500' : ''}
                        />
                        {getFieldError('organization.email') && (
                          <p className="text-xs text-red-600">{getFieldError('organization.email')}</p>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="org_phone">Телефон</Label>
                        <Input
                          id="org_phone"
                          value={organization.phone}
                          onChange={(e) => setOrganization({ ...organization, phone: e.target.value })}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="org_executor">Исполнитель (ФИО)</Label>
                        <Input
                          id="org_executor"
                          value={organization.executor}
                          onChange={(e) => setOrganization({ ...organization, executor: e.target.value })}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="org_address">Адрес</Label>
                      <Textarea
                        id="org_address"
                        value={organization.address}
                        onChange={(e) => setOrganization({ ...organization, address: e.target.value })}
                        rows={2}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="org_reportBasis">Правовое основание отчета</Label>
                      <Input
                        id="org_reportBasis"
                        value={organization.reportBasis}
                        onChange={(e) => setOrganization({ ...organization, reportBasis: e.target.value })}
                      />
                    </div>
                  </TabsContent>

                  {/* Секция 2: Процессы */}
                  <TabsContent value="processes" className="space-y-4 mt-4">
                    <div className="flex justify-between items-center">
                      <h3 className="text-sm font-medium">Процессы и объекты</h3>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={addProcess}
                        className="gap-2"
                      >
                        <Plus className="w-4 h-4" />
                        Добавить процесс
                      </Button>
                    </div>

                    <div className="space-y-3">
                      {processes.map((process, index) => (
                        <Card key={index}>
                          <CardContent className="pt-4">
                            <div className="flex justify-between items-start mb-3">
                              <h4 className="text-sm font-medium">Процесс {index + 1}</h4>
                              {processes.length > 1 && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => removeProcess(index)}
                                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              )}
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                              <div className="space-y-2">
                                <Label>Код процесса</Label>
                                <Input
                                  value={process.code}
                                  onChange={(e) => updateProcess(index, 'code', e.target.value)}
                                  placeholder="1"
                                />
                              </div>

                              <div className="space-y-2">
                                <Label>Код НВОС</Label>
                                <Input
                                  value={process.nvosCode}
                                  onChange={(e) => updateProcess(index, 'nvosCode', e.target.value)}
                                  placeholder="01.01.001"
                                />
                              </div>

                              <div className="col-span-2 space-y-2">
                                <Label>Описание процесса</Label>
                                <Textarea
                                  value={process.description}
                                  onChange={(e) => updateProcess(index, 'description', e.target.value)}
                                  rows={2}
                                  placeholder="Описание производственного процесса..."
                                />
                              </div>

                              <div className="space-y-2">
                                <Label>Мощность</Label>
                                <Input
                                  type="number"
                                  value={process.capacity}
                                  onChange={(e) => updateProcess(index, 'capacity', parseFloat(e.target.value))}
                                  placeholder="1000"
                                />
                              </div>

                              <div className="space-y-2">
                                <Label>Единица измерения</Label>
                                <Input
                                  value={process.unit}
                                  onChange={(e) => updateProcess(index, 'unit', e.target.value)}
                                  placeholder="т/год"
                                />
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </TabsContent>

                  {/* Секция 3: Выбросы */}
                  <TabsContent value="emissions" className="space-y-4 mt-4">
                    <h3 className="text-sm font-medium">Данные о выбросах парниковых газов</h3>

                    <div className="space-y-3">
                      {emissions.map((emission, index) => (
                        <Card key={index}>
                          <CardContent className="pt-4">
                            <h4 className="text-sm font-medium mb-3">{emission.gasType}</h4>

                            <div className="grid grid-cols-2 gap-3">
                              <div className="space-y-2">
                                <Label>Масса газа (т)</Label>
                                <Input
                                  type="number"
                                  step="0.01"
                                  value={emission.mass}
                                  onChange={(e) => updateEmission(index, 'mass', parseFloat(e.target.value) || 0)}
                                  className={getFieldError(`emissions.${index}.mass`) ? 'border-red-500' : ''}
                                />
                                {getFieldError(`emissions.${index}.mass`) && (
                                  <p className="text-xs text-red-600">{getFieldError(`emissions.${index}.mass`)}</p>
                                )}
                              </div>

                              <div className="space-y-2">
                                <Label>GWP (потенциал глобального потепления)</Label>
                                <Input
                                  type="number"
                                  value={emission.gwp}
                                  onChange={(e) => updateEmission(index, 'gwp', parseFloat(e.target.value) || 1)}
                                  disabled={index < 3} // Стандартные GWP не редактируются
                                />
                              </div>

                              <div className="space-y-2">
                                <Label>CO₂-эквивалент (т)</Label>
                                <Input
                                  type="number"
                                  value={emission.co2Equivalent.toFixed(2)}
                                  disabled
                                  className="bg-gray-50"
                                />
                              </div>

                              <div className="space-y-2">
                                <Label>Доля от общих выбросов (%)</Label>
                                <Input
                                  type="number"
                                  value={emission.percentage.toFixed(2)}
                                  disabled
                                  className="bg-gray-50"
                                />
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>

                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <h4 className="text-sm font-medium text-green-900 mb-2">
                        Итого совокупных выбросов
                      </h4>
                      <p className="text-2xl font-bold text-green-700">
                        {totalEmissions.toFixed(2)} тСО₂-экв
                      </p>
                    </div>
                  </TabsContent>

                  {/* Секция 4: Методы */}
                  <TabsContent value="methods" className="space-y-4 mt-4">
                    <div className="flex justify-between items-center">
                      <h3 className="text-sm font-medium">Методы определения выбросов</h3>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={addMethod}
                        className="gap-2"
                      >
                        <Plus className="w-4 h-4" />
                        Добавить метод
                      </Button>
                    </div>

                    <div className="space-y-3">
                      {methods.map((method, index) => (
                        <Card key={index}>
                          <CardContent className="pt-4">
                            <div className="flex justify-between items-start mb-3">
                              <h4 className="text-sm font-medium">Метод {index + 1}</h4>
                              {methods.length > 1 && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => removeMethod(index)}
                                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              )}
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                              <div className="space-y-2">
                                <Label>Код процесса</Label>
                                <Input
                                  value={method.processCode}
                                  onChange={(e) => updateMethod(index, 'processCode', e.target.value)}
                                  placeholder="1"
                                />
                              </div>

                              <div className="space-y-2">
                                <Label>Метод определения</Label>
                                <Input
                                  value={method.method}
                                  onChange={(e) => updateMethod(index, 'method', e.target.value)}
                                  placeholder="Расчетный метод"
                                />
                              </div>

                              <div className="col-span-2 space-y-2">
                                <Label>Источник эмиссионного фактора</Label>
                                <Input
                                  value={method.emissionFactorSource}
                                  onChange={(e) => updateMethod(index, 'emissionFactorSource', e.target.value)}
                                  placeholder="МГЭИК, 2006"
                                />
                              </div>

                              <div className="col-span-2 space-y-2">
                                <Label>Обоснование применения метода</Label>
                                <Textarea
                                  value={method.justification}
                                  onChange={(e) => updateMethod(index, 'justification', e.target.value)}
                                  rows={2}
                                  placeholder="Обоснование выбора данного метода..."
                                />
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </div>

          {/* Правая колонка - Информация */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Информация об отчёте</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <Label className="text-sm text-gray-500">ID отчёта</Label>
                  <p className="text-sm font-mono text-gray-900">{reportId}</p>
                </div>
                <div>
                  <Label className="text-sm text-gray-500">Формат</Label>
                  <p className="text-sm text-gray-900 uppercase">PDF</p>
                </div>
                <div>
                  <Label className="text-sm text-gray-500">Дата создания</Label>
                  <p className="text-sm text-gray-900">
                    {report?.createdDate || 'Не указана'}
                  </p>
                </div>
                <div>
                  <Label className="text-sm text-gray-500">Количество документов</Label>
                  <p className="text-sm text-gray-900">
                    {report?.documentCount || 0}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Инструкция по редактированию</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-gray-600">
                <p>
                  <strong>1. Общие данные:</strong> Название, период, примечания
                </p>
                <p>
                  <strong>2. Организация:</strong> Реквизиты компании (ИНН, ОГРН, ОКВЭД)
                </p>
                <p>
                  <strong>3. Процессы:</strong> Производственные процессы и объекты
                </p>
                <p>
                  <strong>4. Выбросы:</strong> Данные о выбросах ПГ с автоматическим пересчетом
                </p>
                <p>
                  <strong>5. Методы:</strong> Методы определения и расчета выбросов
                </p>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mt-4">
                  <p className="text-blue-800 text-xs">
                    💡 <strong>Совет:</strong> CO₂-эквиваленты пересчитываются автоматически при изменении массы газа
                  </p>
                </div>
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mt-2">
                  <p className="text-amber-800 text-xs">
                    ⚠️ <strong>Внимание:</strong> Поля с * обязательны для заполнения
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
