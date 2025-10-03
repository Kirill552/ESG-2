"use client";

import { useState, useEffect } from 'react';
import { Document, Page } from 'react-pdf';
import { pdfjs } from 'react-pdf';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import 'react-pdf/dist/esm/Page/TextLayer.css';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import {
  Download,
  Edit3,
  Save,
  X,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  FileText,
  Code
} from 'lucide-react';

// Настройка worker для PDF.js
if (typeof window !== 'undefined') {
  pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.js`;
}

interface ReportViewerProps {
  reportId: string;
  reportName: string;
  reportFormat: 'pdf' | 'xml';
  mode: 'view' | 'edit';
  onClose: () => void;
}

export function ReportViewer({ reportId, reportName, reportFormat, mode: initialMode, onClose }: ReportViewerProps) {
  const [mode, setMode] = useState<'view' | 'edit'>(initialMode);
  const [loading, setLoading] = useState(true);
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState(1);
  const [scale, setScale] = useState(1.0);
  const [pdfUrl, setPdfUrl] = useState<string>('');
  const [xmlContent, setXmlContent] = useState<string>('');
  const [editData, setEditData] = useState({
    organizationName: '',
    totalEmissions: '',
    scope1: '',
    scope2: '',
    scope3: '',
    notes: ''
  });

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

      // Загружаем данные для редактирования
      const reportResponse = await fetch(`/api/reports/${reportId}`);
      const reportData = await reportResponse.json();

      if (reportData.ok) {
        setEditData({
          organizationName: reportData.organization?.name || '',
          totalEmissions: reportData.totalEmissions?.toString() || '0',
          scope1: reportData.emissionData?.scope1?.toString() || '0',
          scope2: reportData.emissionData?.scope2?.toString() || '0',
          scope3: reportData.emissionData?.scope3?.toString() || '0',
          notes: reportData.notes || ''
        });
      }
    } catch (error) {
      console.error('Error loading report:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      const response = await fetch(`/api/reports/${reportId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: reportName, // Сохраняем текущее имя
          totalEmissions: parseFloat(editData.totalEmissions),
          emissionData: {
            scope1: parseFloat(editData.scope1),
            scope2: parseFloat(editData.scope2),
            scope3: parseFloat(editData.scope3)
          },
          notes: editData.notes
        })
      });

      if (response.ok) {
        alert('Отчет успешно сохранен!');
        setMode('view');
        loadReportData();
      } else {
        const data = await response.json();
        alert(`Ошибка: ${data.error || 'Не удалось сохранить отчет'}`);
      }
    } catch (error) {
      console.error('Error saving report:', error);
      alert('Ошибка при сохранении отчета');
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
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[100] p-4">
      <Card className="w-full max-w-7xl h-[90vh] flex flex-col bg-white shadow-2xl">
        <CardHeader className="border-b bg-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {reportFormat === 'pdf' ? <FileText className="w-6 h-6" /> : <Code className="w-6 h-6" />}
              <CardTitle>{reportName}</CardTitle>
            </div>
            <div className="flex items-center gap-2">
              {mode === 'view' ? (
                <>
                  <Button variant="outline" size="sm" onClick={() => setMode('edit')}>
                    <Edit3 className="w-4 h-4 mr-2" />
                    Редактировать
                  </Button>
                  <Button variant="outline" size="sm">
                    <Download className="w-4 h-4 mr-2" />
                    Скачать
                  </Button>
                </>
              ) : (
                <>
                  <Button variant="outline" size="sm" onClick={() => setMode('view')}>
                    <X className="w-4 h-4 mr-2" />
                    Отмена
                  </Button>
                  <Button size="sm" onClick={handleSave} className="bg-[#1dc962] hover:bg-[#1dc962]/90">
                    <Save className="w-4 h-4 mr-2" />
                    Сохранить
                  </Button>
                </>
              )}
              <Button variant="ghost" size="sm" onClick={onClose}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="flex-1 overflow-hidden p-0 bg-white">
          {mode === 'view' ? (
            <Tabs defaultValue="preview" className="h-full flex flex-col">
              <TabsList className="mx-6 mt-4">
                <TabsTrigger value="preview">Просмотр</TabsTrigger>
                <TabsTrigger value="data">Данные</TabsTrigger>
              </TabsList>

              <TabsContent value="preview" className="flex-1 overflow-auto m-6">
                {reportFormat === 'pdf' ? (
                  <div className="flex flex-col items-center gap-4">
                    <div className="flex items-center gap-4 bg-gray-100 p-2 rounded-lg">
                      <Button variant="outline" size="sm" onClick={() => setScale(s => Math.max(0.5, s - 0.1))}>
                        <ZoomOut className="w-4 h-4" />
                      </Button>
                      <span className="text-sm font-medium">{Math.round(scale * 100)}%</span>
                      <Button variant="outline" size="sm" onClick={() => setScale(s => Math.min(2, s + 0.1))}>
                        <ZoomIn className="w-4 h-4" />
                      </Button>

                      <div className="border-l border-gray-300 h-6 mx-2"></div>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPageNumber(p => Math.max(1, p - 1))}
                        disabled={pageNumber <= 1}
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </Button>
                      <span className="text-sm font-medium">
                        {pageNumber} / {numPages}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPageNumber(p => Math.min(numPages, p + 1))}
                        disabled={pageNumber >= numPages}
                      >
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </div>

                    <div className="border rounded-lg shadow-lg bg-white">
                      <Document
                        file={pdfUrl}
                        onLoadSuccess={onDocumentLoadSuccess}
                        loading={<div className="p-8">Загрузка PDF...</div>}
                      >
                        <Page pageNumber={pageNumber} scale={scale} />
                      </Document>
                    </div>
                  </div>
                ) : (
                  <div className="h-full">
                    <pre className="bg-gray-50 p-4 rounded-lg h-full overflow-auto font-mono text-sm">
                      {xmlContent}
                    </pre>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="data" className="flex-1 overflow-auto m-6">
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <Label>Организация</Label>
                    <p className="text-sm text-gray-600 mt-1">{editData.organizationName || 'Не указано'}</p>
                  </div>
                  <div>
                    <Label>Общие выбросы</Label>
                    <p className="text-sm text-gray-600 mt-1">{editData.totalEmissions} тСО₂</p>
                  </div>
                  <div>
                    <Label>Scope 1 (Прямые)</Label>
                    <p className="text-sm text-gray-600 mt-1">{editData.scope1} тСО₂</p>
                  </div>
                  <div>
                    <Label>Scope 2 (Энергетические)</Label>
                    <p className="text-sm text-gray-600 mt-1">{editData.scope2} тСО₂</p>
                  </div>
                  <div>
                    <Label>Scope 3 (Косвенные)</Label>
                    <p className="text-sm text-gray-600 mt-1">{editData.scope3} тСО₂</p>
                  </div>
                  <div className="col-span-2">
                    <Label>Примечания</Label>
                    <p className="text-sm text-gray-600 mt-1 whitespace-pre-wrap">{editData.notes || 'Нет примечаний'}</p>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          ) : (
            <div className="h-full overflow-auto p-6">
              <div className="max-w-4xl mx-auto space-y-6">
                <div className="grid grid-cols-2 gap-6">
                  <div className="col-span-2">
                    <Label htmlFor="orgName">Название организации</Label>
                    <Input
                      id="orgName"
                      value={editData.organizationName}
                      onChange={(e) => setEditData({ ...editData, organizationName: e.target.value })}
                      placeholder="ООО Пример"
                    />
                  </div>

                  <div>
                    <Label htmlFor="scope1">Scope 1 - Прямые выбросы (тСО₂)</Label>
                    <Input
                      id="scope1"
                      type="number"
                      value={editData.scope1}
                      onChange={(e) => setEditData({ ...editData, scope1: e.target.value })}
                    />
                  </div>

                  <div>
                    <Label htmlFor="scope2">Scope 2 - Энергетические (тСО₂)</Label>
                    <Input
                      id="scope2"
                      type="number"
                      value={editData.scope2}
                      onChange={(e) => setEditData({ ...editData, scope2: e.target.value })}
                    />
                  </div>

                  <div>
                    <Label htmlFor="scope3">Scope 3 - Косвенные (тСО₂)</Label>
                    <Input
                      id="scope3"
                      type="number"
                      value={editData.scope3}
                      onChange={(e) => setEditData({ ...editData, scope3: e.target.value })}
                    />
                  </div>

                  <div>
                    <Label htmlFor="total">Общие выбросы (тСО₂)</Label>
                    <Input
                      id="total"
                      type="number"
                      value={editData.totalEmissions}
                      onChange={(e) => setEditData({ ...editData, totalEmissions: e.target.value })}
                    />
                  </div>

                  <div className="col-span-2">
                    <Label htmlFor="notes">Примечания</Label>
                    <Textarea
                      id="notes"
                      value={editData.notes}
                      onChange={(e) => setEditData({ ...editData, notes: e.target.value })}
                      placeholder="Дополнительная информация о отчете..."
                      rows={4}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
