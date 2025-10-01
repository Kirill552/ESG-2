"use client";

/**
 * Модальное окно для предупреждения о недостающих данных организации
 * Показывается при попытке генерации отчета 296-ФЗ с неполными реквизитами
 */

import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, CheckCircle2, FileText } from "lucide-react";
import Link from "next/link";

interface OrganizationDataModalProps {
  isOpen: boolean;
  onClose: () => void;
  missingFields: string[];
  warnings: string[];
  onGoToSettings?: () => void;
}

export function OrganizationDataModal({
  isOpen,
  onClose,
  missingFields,
  warnings,
  onGoToSettings,
}: OrganizationDataModalProps) {
  const hasMissingFields = missingFields.length > 0;
  const hasWarnings = warnings.length > 0;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {hasMissingFields ? (
              <>
                <AlertCircle className="h-5 w-5 text-destructive" />
                Дополните данные организации
              </>
            ) : (
              <>
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                Данные организации заполнены
              </>
            )}
          </DialogTitle>
          <DialogDescription>
            {hasMissingFields
              ? "Для генерации отчета 296-ФЗ необходимо заполнить все обязательные реквизиты организации."
              : "Все обязательные поля заполнены. Вы можете продолжить генерацию отчета."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Обязательные недостающие поля */}
          {hasMissingFields && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <div className="font-semibold mb-2">
                  Не заполнены обязательные поля ({missingFields.length}):
                </div>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  {missingFields.map((field, index) => (
                    <li key={index}>{field}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          {/* Рекомендации */}
          {hasWarnings && (
            <Alert>
              <FileText className="h-4 w-4" />
              <AlertDescription>
                <div className="font-semibold mb-2">Рекомендации:</div>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  {warnings.map((warning, index) => (
                    <li key={index}>{warning}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          {/* Инструкция */}
          {hasMissingFields && (
            <div className="bg-muted p-4 rounded-lg text-sm">
              <p className="font-medium mb-2">💡 Как заполнить данные:</p>
              <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                <li>
                  Перейдите в раздел{" "}
                  <span className="font-semibold text-foreground">
                    Настройки → Организация
                  </span>
                </li>
                <li>
                  Введите <span className="font-semibold text-foreground">ИНН</span> организации
                  (автозаполнение из ЕГРЮЛ)
                </li>
                <li>Проверьте и дополните реквизиты при необходимости</li>
                <li>Нажмите "Сохранить изменения"</li>
              </ol>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>
            Закрыть
          </Button>
          {hasMissingFields && (
            <Link href="/settings?tab=organization" passHref>
              <Button
                onClick={() => {
                  onGoToSettings?.();
                  onClose();
                }}
              >
                Перейти в настройки
              </Button>
            </Link>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
