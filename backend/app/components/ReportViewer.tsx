"use client";

import { useState, useEffect } from 'react';
import { Document, Page } from 'react-pdf';
import { pdfjs } from 'react-pdf';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import {
  Download,
  X,
  ZoomIn,
  ZoomOut,
  FileText,
  Code,
  Maximize2
} from 'lucide-react';

// ВАЖНО: Импорт стилей для TextLayer и AnnotationLayer
import 'react-pdf/dist/Page/TextLayer.css';
import 'react-pdf/dist/Page/AnnotationLayer.css';

// Настройка worker для PDF.js (используем локальную копию)
if (typeof window !== 'undefined') {
  pdfjs.GlobalWorkerOptions.workerSrc = '/pdf-worker/pdf.worker.min.mjs';
}

interface ReportViewerProps {
  reportId: string;
  reportName: string;
  reportFormat: 'pdf' | 'xml';
  onClose: () => void;
}

export function ReportViewer({ reportId, reportName, reportFormat, onClose }: ReportViewerProps) {
  const [loading, setLoading] = useState(true);
  const [numPages, setNumPages] = useState<number>(0);
  const [scale, setScale] = useState(2.0); // ✅ Установлен масштаб 200% по умолчанию
  const [pdfUrl, setPdfUrl] = useState<string>('');
  const [xmlContent, setXmlContent] = useState<string>('');
  const [reportData, setReportData] = useState<any>(null);

  useEffect(() => {
    loadReportData();
  }, [reportId]);

  const loadReportData = async () => {
    try {
      setLoading(true);

      if (reportFormat === 'pdf') {
        // Загружаем PDF
        const response = await fetch(`/api/reports/${reportId}/download`);
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        setPdfUrl(url);
      } else {
        // Загружаем XML
        const response = await fetch(`/api/reports/${reportId}/xml`);
        const data = await response.json();
        setXmlContent(data.content || '<?xml version="1.0"?>\n<report>\n  <placeholder>XML content here</placeholder>\n</report>');
      }

      // Загружаем данные отчёта
      const reportResponse = await fetch(`/api/reports/${reportId}`);
      const data = await reportResponse.json();
      setReportData(data);
    } catch (error) {
      console.error('Error loading report:', error);
    } finally {
      setLoading(false);
    }
  };


  const handleDownloadReport = async () => {
    try {
      const response = await fetch(`/api/reports/${reportId}/download`);

      if (!response.ok) {
        throw new Error('Не удалось скачать отчет');
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
      console.error('Error downloading report:', error);
      alert('Ошибка при скачивании отчета');
    }
  };

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <Card className="w-full max-w-4xl">
          <CardContent className="p-8 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#1dc962] mx-auto"></div>
            <p className="mt-4 text-gray-600">Загрузка отчета...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100]">
      <Card className="w-[98vw] h-[96vh] flex flex-col bg-white shadow-2xl">
        <Tabs defaultValue="preview" className="h-full flex flex-col">
        <CardHeader className="border-b bg-white py-3 px-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {reportFormat === 'pdf' ? <FileText className="w-5 h-5 text-[#1dc962]" /> : <Code className="w-5 h-5 text-[#1dc962]" />}
              <CardTitle className="text-lg">{reportName}</CardTitle>
            </div>
            <div className="flex items-center gap-4">
              {/* Вкладки */}
              <TabsList>
                <TabsTrigger value="preview">Просмотр</TabsTrigger>
                <TabsTrigger value="data">Данные</TabsTrigger>
              </TabsList>

              {/* Контролы зума (только для PDF) */}
              {reportFormat === 'pdf' && (
                <div className="flex items-center gap-1.5 border-l pl-4">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0"
                    onClick={() => setScale(s => Math.max(0.5, s - 0.1))}
                  >
                    <ZoomOut className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0"
                    onClick={() => setScale(s => Math.min(3, s + 0.1))}
                  >
                    <ZoomIn className="w-3.5 h-3.5" />
                  </Button>
                </div>
              )}

              {/* Кнопки действий */}
              <div className="flex items-center gap-2 border-l pl-4">
                <Button variant="outline" size="sm" onClick={handleDownloadReport}>
                  <Download className="w-4 h-4 mr-2" />
                  Скачать
                </Button>
                <Button variant="ghost" size="sm" onClick={onClose}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="flex-1 overflow-hidden p-0 bg-gray-50">
          {/* Контент */}
          <TabsContent value="preview" className="h-full overflow-auto px-6 pb-6 pt-4">
                {reportFormat === 'pdf' ? (
                  <div className="flex flex-col gap-4 w-full items-center">
                    <Document
                      file={pdfUrl}
                      onLoadSuccess={onDocumentLoadSuccess}
                      loading={<div className="p-8 text-center text-gray-500">Загрузка PDF...</div>}
                    >
                      {Array.from(new Array(numPages), (_, index) => (
                        <div key={index} className="border rounded-lg shadow-md bg-white overflow-hidden">
                          <Page
                            pageNumber={index + 1}
                            scale={scale}
                            renderTextLayer={true}
                            renderAnnotationLayer={true}
                          />
                        </div>
                      ))}
                    </Document>
                  </div>
                ) : (
                  <div className="h-full bg-white rounded-lg border">
                    <pre className="p-4 h-full overflow-auto font-mono text-sm">
                      {xmlContent}
                    </pre>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="data" className="flex-1 overflow-auto px-6 pb-6">
                <div className="bg-white rounded-lg border p-6 max-w-[1000px] mx-auto">
                  <h3 className="text-lg font-semibold mb-4 text-gray-900">Данные отчета</h3>
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-1">
                      <Label className="text-sm font-medium text-gray-700">Организация</Label>
                      <p className="text-base text-gray-900">{reportData?.documents?.[0]?.organization?.name || 'Не указано'}</p>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-sm font-medium text-gray-700">ИНН</Label>
                      <p className="text-base text-gray-900">{reportData?.documents?.[0]?.organization?.inn || 'Не указано'}</p>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-sm font-medium text-gray-700">Период</Label>
                      <p className="text-base text-gray-900">{reportData?.period || 'Не указано'}</p>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-sm font-medium text-gray-700">Тип отчета</Label>
                      <p className="text-base text-gray-900">{reportData?.type || 'Не указано'}</p>
                    </div>
                    <div className="col-span-2 pt-4 border-t">
                      <Label className="text-sm font-medium text-gray-700">Общие выбросы парниковых газов</Label>
                      <p className="text-2xl font-bold text-[#1dc962] mt-2">
                        {reportData?.totalEmissions?.toFixed(2) || '0.00'} <span className="text-lg font-normal text-gray-600">тонн CO₂</span>
                      </p>
                    </div>
                    {reportData?.emissionData && (
                      <div className="col-span-2 pt-4 border-t">
                        <Label className="text-sm font-medium text-gray-700 mb-3 block">Разбивка по источникам</Label>
                        <div className="grid grid-cols-3 gap-4">
                          {reportData.emissionData.sources?.energy !== undefined && (
                            <div className="bg-blue-50 p-3 rounded-lg">
                              <p className="text-xs text-blue-700 font-medium">Энергия</p>
                              <p className="text-lg font-semibold text-blue-900">{reportData.emissionData.sources.energy.toFixed(2)} т</p>
                            </div>
                          )}
                          {reportData.emissionData.sources?.transport !== undefined && (
                            <div className="bg-green-50 p-3 rounded-lg">
                              <p className="text-xs text-green-700 font-medium">Транспорт</p>
                              <p className="text-lg font-semibold text-green-900">{reportData.emissionData.sources.transport.toFixed(2)} т</p>
                            </div>
                          )}
                          {reportData.emissionData.sources?.production !== undefined && (
                            <div className="bg-orange-50 p-3 rounded-lg">
                              <p className="text-xs text-orange-700 font-medium">Производство</p>
                              <p className="text-lg font-semibold text-orange-900">{reportData.emissionData.sources.production.toFixed(2)} т</p>
                            </div>
                          )}
                          {reportData.emissionData.sources?.waste !== undefined && (
                            <div className="bg-red-50 p-3 rounded-lg">
                              <p className="text-xs text-red-700 font-medium">Отходы</p>
                              <p className="text-lg font-semibold text-red-900">{reportData.emissionData.sources.waste.toFixed(2)} т</p>
                            </div>
                          )}
                          {reportData.emissionData.sources?.suppliers !== undefined && (
                            <div className="bg-purple-50 p-3 rounded-lg">
                              <p className="text-xs text-purple-700 font-medium">Поставщики</p>
                              <p className="text-lg font-semibold text-purple-900">{reportData.emissionData.sources.suppliers.toFixed(2)} т</p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                    <div className="col-span-2 pt-4 border-t">
                      <Label className="text-sm font-medium text-gray-700">Примечания</Label>
                      <p className="text-sm text-gray-600 mt-1 whitespace-pre-wrap">{reportData?.notes || 'Нет примечаний'}</p>
                    </div>
                  </div>
                </div>
              </TabsContent>
        </CardContent>
        </Tabs>
      </Card>
    </div>
  );
}
