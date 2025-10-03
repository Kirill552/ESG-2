"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { AlertCircle, CheckCircle, Clock, Zap } from "lucide-react";

interface OcrResultData {
  documentId: string;
  fileName: string;
  originalName: string;
  fileSize: number;
  fileType: string;
  status: string;
  processing: {
    stage: string;
    progress: number;
    message: string;
    startedAt?: string;
    completedAt?: string;
    processingTime?: number;
  };
  ocr: {
    provider: string;
    confidence: number;
    fullText: string;
    textPreview: string;
    textLength: number;
    processedAt?: string;
  };
  formatInfo?: {
    format: string;
    confidence: number;
    sheets?: string[];
    delimiter?: string;
    encoding?: string;
    recommendedParser?: string;
  };
  structuredData?: any;
  metadata?: {
    processingSteps?: Array<{
      step: string;
      duration: number;
      success: boolean;
    }>;
    qualityScore?: number;
    extractedUnits?: string[];
    carbonFootprint?: number;
    totalCost?: number;
    suppliers?: number;
  };
  healthCheckResults?: {
    overall: string;
    checks: Array<{
      name: string;
      status: string;
      score: number;
    }>;
  };
  timestamps: {
    created: string;
    updated: string;
  };
}

interface OcrResultModalProps {
  isOpen: boolean;
  onClose: () => void;
  documentId: string;
  documentName: string;
}

export default function OcrResultModal({
  isOpen,
  onClose,
  documentId,
  documentName
}: OcrResultModalProps) {
  const [loading, setLoading] = useState(false);
  const [ocrResult, setOcrResult] = useState<OcrResultData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && documentId) {
      fetchOcrResult();
    }
  }, [isOpen, documentId]);

  const fetchOcrResult = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/ocr/results/${documentId}`);
      const data = await response.json();

      if (!data.ok) {
        throw new Error(data.message || "Не удалось загрузить результат OCR");
      }

      setOcrResult(data.result);
      console.log("OCR result loaded", { documentId, textLength: data.result.ocr.textLength });

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Неизвестная ошибка";
      setError(errorMessage);
      console.error("Failed to load OCR result", err, { documentId });
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case 'processed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'processing':
        return <Clock className="h-4 w-4 text-blue-500" />;
      case 'failed':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'processed':
        return 'bg-green-500';
      case 'processing':
        return 'bg-blue-500';
      case 'failed':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  const formatFileSize = (bytes: number) => {
    const sizes = ['Б', 'КБ', 'МБ', 'ГБ'];
    if (bytes === 0) return '0 Б';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round((bytes / Math.pow(1024, i)) * 100) / 100 + ' ' + sizes[i];
  };

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms} мс`;
    if (ms < 60000) return `${Math.round(ms / 100) / 10} сек`;
    return `${Math.round(ms / 6000) / 10} мин`;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl w-full max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-blue-500" />
            Результат OCR обработки: {documentName}
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col h-full max-h-[calc(90vh-120px)]">
          {loading && (
            <div className="flex items-center justify-center p-8">
              <div className="flex items-center gap-2">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
                <span>Загрузка результатов OCR...</span>
              </div>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 p-4 bg-red-50 text-red-800 rounded-lg">
              <AlertCircle className="h-5 w-5" />
              <span>{error}</span>
            </div>
          )}

          {ocrResult && (
            <ScrollArea className="flex-1">
              <div className="space-y-6 pr-4">
                {/* Статус и общая информация */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      {getStatusIcon(ocrResult.status)}
                      Статус обработки
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center gap-4">
                      <Badge className={getStatusColor(ocrResult.status)}>
                        {ocrResult.status === 'PROCESSED' && 'Обработано'}
                        {ocrResult.status === 'PROCESSING' && 'Обрабатывается'}
                        {ocrResult.status === 'FAILED' && 'Ошибка'}
                      </Badge>
                      <span className="text-sm text-gray-600">
                        Провайдер: {ocrResult.ocr.provider}
                      </span>
                    </div>

                    {ocrResult.processing.progress !== undefined && (
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span>Прогресс</span>
                          <span>{ocrResult.processing.progress}%</span>
                        </div>
                        <Progress value={ocrResult.processing.progress} />
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-600">Размер файла:</span>
                        <span className="ml-2">{formatFileSize(ocrResult.fileSize)}</span>
                      </div>
                      <div>
                        <span className="text-gray-600">Тип файла:</span>
                        <span className="ml-2">{ocrResult.formatInfo?.format || 'неизвестен'}</span>
                      </div>
                      <div>
                        <span className="text-gray-600">Уверенность OCR:</span>
                        <span className="ml-2">{Math.round(ocrResult.ocr.confidence * 100)}%</span>
                      </div>
                      {ocrResult.processing.processingTime && (
                        <div>
                          <span className="text-gray-600">Время обработки:</span>
                          <span className="ml-2">{formatDuration(ocrResult.processing.processingTime)}</span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Извлеченный текст */}
                <Card>
                  <CardHeader>
                    <CardTitle>Извлеченный текст</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {ocrResult.ocr.fullText ? (
                      <div className="space-y-4">
                        <div className="text-sm text-gray-600">
                          Длина текста: {ocrResult.ocr.textLength.toLocaleString()} символов
                        </div>
                        <div className="h-96 w-full border rounded p-4 overflow-auto bg-gray-50">
                          <pre className="whitespace-pre-wrap text-sm font-mono">
                            {ocrResult.ocr.fullText}
                          </pre>
                        </div>
                      </div>
                    ) : (
                      <div className="text-gray-500 italic">
                        Текст не извлечен
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Структурированные данные */}
                {ocrResult.structuredData && Object.keys(ocrResult.structuredData).length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Структурированные данные</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {Object.entries(ocrResult.structuredData).map(([key, data]: [string, any]) => (
                          <div key={key} className="space-y-2">
                            <h4 className="font-medium capitalize">
                              {key.replace(/_/g, ' ')}
                            </h4>
                            {Array.isArray(data) ? (
                              <div className="bg-gray-50 p-3 rounded text-sm">
                                {data.map((item, index) => (
                                  <div key={index} className="mb-2 last:mb-0">
                                    {typeof item === 'object' ?
                                      JSON.stringify(item, null, 2) :
                                      String(item)
                                    }
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="bg-gray-50 p-3 rounded text-sm">
                                {typeof data === 'object' ?
                                  JSON.stringify(data, null, 2) :
                                  String(data)
                                }
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Метаданные */}
                {ocrResult.metadata && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Метаданные обработки</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {ocrResult.metadata.qualityScore && (
                        <div>
                          <span className="text-gray-600">Оценка качества:</span>
                          <span className="ml-2">{Math.round(ocrResult.metadata.qualityScore * 100)}%</span>
                        </div>
                      )}

                      {ocrResult.metadata.extractedUnits && (
                        <div>
                          <span className="text-gray-600">Найденные единицы измерения:</span>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {ocrResult.metadata.extractedUnits.map((unit, index) => (
                              <Badge key={index} variant="outline">{unit}</Badge>
                            ))}
                          </div>
                        </div>
                      )}

                      {ocrResult.metadata.carbonFootprint && (
                        <div>
                          <span className="text-gray-600">Углеродный след:</span>
                          <span className="ml-2">{ocrResult.metadata.carbonFootprint} кг CO₂</span>
                        </div>
                      )}

                      {ocrResult.metadata.processingSteps && (
                        <div>
                          <h4 className="font-medium mb-2">Этапы обработки:</h4>
                          <div className="space-y-1">
                            {ocrResult.metadata.processingSteps.map((step, index) => (
                              <div key={index} className="flex items-center justify-between text-sm">
                                <span className="flex items-center gap-2">
                                  {step.success ? (
                                    <CheckCircle className="h-3 w-3 text-green-500" />
                                  ) : (
                                    <AlertCircle className="h-3 w-3 text-red-500" />
                                  )}
                                  {step.step.replace(/_/g, ' ')}
                                </span>
                                <span className="text-gray-500">
                                  {formatDuration(step.duration)}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* Health Check Results */}
                {ocrResult.healthCheckResults && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Результаты проверки качества</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <span className="text-gray-600">Общий статус:</span>
                          <Badge variant={ocrResult.healthCheckResults.overall === 'healthy' ? 'default' : 'destructive'}>
                            {ocrResult.healthCheckResults.overall === 'healthy' ? 'Хорошо' : 'Есть проблемы'}
                          </Badge>
                        </div>

                        <div className="space-y-2">
                          {ocrResult.healthCheckResults.checks.map((check, index) => (
                            <div key={index} className="flex items-center justify-between">
                              <span className="text-sm">{check.name.replace(/_/g, ' ')}</span>
                              <div className="flex items-center gap-2">
                                <span className="text-sm text-gray-600">
                                  {Math.round(check.score * 100)}%
                                </span>
                                {check.status === 'passed' ? (
                                  <CheckCircle className="h-4 w-4 text-green-500" />
                                ) : (
                                  <AlertCircle className="h-4 w-4 text-red-500" />
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            </ScrollArea>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}