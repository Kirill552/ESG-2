import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from './ui/dialog';
import { Button } from './ui/button';
import { Alert, AlertDescription } from './ui/alert';
import { ScrollArea } from './ui/scroll-area';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Loader2,
  ExternalLink,
  FileText,
  Building2,
  User,
} from 'lucide-react';
import { Badge } from './ui/badge';

interface ValidationError {
  field: string;
  message: string;
  severity: 'critical' | 'warning';
  redirectUrl?: string;
}

interface ValidationResult {
  canGenerate: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
  missingFields: string[];
}

interface ValidationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onContinue: () => void;
  onNavigateToSettings?: (url: string) => void;
}

export function ValidationModal({
  isOpen,
  onClose,
  onContinue,
  onNavigateToSettings,
}: ValidationModalProps) {
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchValidation();
    }
  }, [isOpen]);

  const fetchValidation = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/reports/validate');

      if (!response.ok) {
        throw new Error('Не удалось проверить данные организации');
      }

      const data = await response.json();
      setValidationResult(data);
    } catch (err) {
      console.error('Validation error:', err);
      setError(err instanceof Error ? err.message : 'Ошибка при проверке данных');
    } finally {
      setLoading(false);
    }
  };

  const handleNavigate = (redirectUrl?: string) => {
    if (redirectUrl && onNavigateToSettings) {
      onNavigateToSettings(redirectUrl);
      onClose();
    }
  };

  const getIconForSeverity = (severity: 'critical' | 'warning') => {
    if (severity === 'critical') {
      return <XCircle className="w-5 h-5 text-red-600 flex-shrink-0" />;
    }
    return <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0" />;
  };

  const getCategoryIcon = (field: string) => {
    if (field.includes('ИНН') || field.includes('ОГРН') || field.includes('ОКПО')) {
      return <Building2 className="w-4 h-4" />;
    }
    if (field.includes('руководител') || field.includes('ответственн')) {
      return <User className="w-4 h-4" />;
    }
    return <FileText className="w-4 h-4" />;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[650px] max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Проверка данных...
              </>
            ) : validationResult?.canGenerate ? (
              <>
                <CheckCircle2 className="w-5 h-5 text-green-600" />
                Готово к генерации
              </>
            ) : (
              <>
                <AlertCircle className="w-5 h-5 text-red-600" />
                Требуется дополнение данных
              </>
            )}
          </DialogTitle>
          <DialogDescription>
            {loading
              ? 'Проверяем данные организации и документы...'
              : validationResult?.canGenerate
              ? 'Все обязательные данные заполнены. Вы можете продолжить создание отчета.'
              : 'Для создания отчета 296-ФЗ необходимо заполнить обязательные данные организации.'}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[500px] pr-4">
          <div className="space-y-4">
            {/* Ошибка загрузки */}
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* Загрузка */}
            {loading && (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
              </div>
            )}

            {/* Результаты валидации */}
            {!loading && validationResult && (
              <>
                {/* Критические ошибки */}
                {validationResult.errors.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <XCircle className="w-4 h-4 text-red-600" />
                      <h4 className="font-semibold text-sm text-red-900">
                        Критические ошибки ({validationResult.errors.length})
                      </h4>
                      <Badge variant="destructive" className="ml-auto">
                        Блокируют создание
                      </Badge>
                    </div>

                    <div className="space-y-2">
                      {validationResult.errors.map((err, index) => (
                        <Alert key={index} variant="destructive" className="border-red-200">
                          <div className="flex items-start gap-3">
                            {getIconForSeverity(err.severity)}
                            <div className="flex-1 space-y-1">
                              <div className="flex items-center gap-2">
                                {getCategoryIcon(err.field)}
                                <span className="font-medium text-sm">{err.field}</span>
                              </div>
                              <p className="text-sm text-red-800">{err.message}</p>
                              {err.redirectUrl && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="mt-2 h-8 text-xs border-red-300 hover:bg-red-50"
                                  onClick={() => handleNavigate(err.redirectUrl)}
                                >
                                  <ExternalLink className="w-3 h-3 mr-1" />
                                  Заполнить данные
                                </Button>
                              )}
                            </div>
                          </div>
                        </Alert>
                      ))}
                    </div>
                  </div>
                )}

                {/* Предупреждения */}
                {validationResult.warnings.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-600" />
                      <h4 className="font-semibold text-sm text-amber-900">
                        Рекомендации ({validationResult.warnings.length})
                      </h4>
                      <Badge variant="outline" className="ml-auto border-amber-300 text-amber-700">
                        Не блокируют
                      </Badge>
                    </div>

                    <div className="space-y-2">
                      {validationResult.warnings.map((warning, index) => (
                        <Alert key={index} className="border-amber-200 bg-amber-50/50">
                          <div className="flex items-start gap-3">
                            {getIconForSeverity(warning.severity)}
                            <div className="flex-1 space-y-1">
                              <div className="flex items-center gap-2">
                                {getCategoryIcon(warning.field)}
                                <span className="font-medium text-sm text-amber-900">{warning.field}</span>
                              </div>
                              <p className="text-sm text-amber-800">{warning.message}</p>
                              {warning.redirectUrl && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="mt-2 h-8 text-xs border-amber-300 hover:bg-amber-50"
                                  onClick={() => handleNavigate(warning.redirectUrl)}
                                >
                                  <ExternalLink className="w-3 h-3 mr-1" />
                                  Дополнить данные
                                </Button>
                              )}
                            </div>
                          </div>
                        </Alert>
                      ))}
                    </div>
                  </div>
                )}

                {/* Успешная валидация */}
                {validationResult.canGenerate &&
                  validationResult.errors.length === 0 &&
                  validationResult.warnings.length === 0 && (
                    <Alert className="border-green-200 bg-green-50">
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      <AlertDescription className="text-green-800">
                        Все обязательные данные заполнены корректно. Система готова к генерации отчета
                        296-ФЗ.
                      </AlertDescription>
                    </Alert>
                  )}
              </>
            )}
          </div>
        </ScrollArea>

        <DialogFooter className="flex items-center gap-2">
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Отмена
          </Button>

          {validationResult?.canGenerate ? (
            <Button
              onClick={() => {
                onContinue();
                onClose();
              }}
              disabled={loading}
              className="bg-[#1dc962] hover:bg-[#1dc962]/90"
            >
              <CheckCircle2 className="w-4 h-4 mr-2" />
              Продолжить создание
            </Button>
          ) : (
            <Button
              onClick={() => handleNavigate('/settings')}
              disabled={loading}
              className="bg-[#1dc962] hover:bg-[#1dc962]/90"
            >
              <ExternalLink className="w-4 h-4 mr-2" />
              Перейти в настройки
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
