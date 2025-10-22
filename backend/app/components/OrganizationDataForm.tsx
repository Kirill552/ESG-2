"use client";

/**
 * Форма для заполнения дополнительных данных организации
 * Показывается когда не хватает данных для генерации отчета 296-ФЗ
 */

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Loader2, CheckCircle2 } from "lucide-react";
import { useState } from "react";

interface OrganizationDataFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  missingFields?: string[];
  warnings?: string[];
}

export function OrganizationDataForm({
  isOpen,
  onClose,
  onSuccess,
  missingFields = [],
  warnings = [],
}: OrganizationDataFormProps) {
  const [formData, setFormData] = useState({
    ogrn: '',
    kpp: '',
    okpo: '',
    oktmo: '',
    okato: '',
    okved: '',
    fullName: '',
    legalAddress: '',
    directorName: '',
    directorPosition: '',
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);

      const response = await fetch('/api/settings/organization', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formData.fullName || 'Моя организация',
          inn: '0000000000', // Будет взят из существующей записи
          kpp: formData.kpp,
          ogrn: formData.ogrn,
          okvedCode: formData.okved,
          address: formData.legalAddress,
          director: formData.directorName,
          directorPosition: formData.directorPosition,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Не удалось сохранить данные');
      }

      onSuccess();
      onClose();
    } catch (err) {
      console.error('Error saving organization data:', err);
      setError(err instanceof Error ? err.message : 'Ошибка сохранения данных');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-[#1dc962]" />
            Дополните данные организации
          </DialogTitle>
          <DialogDescription>
            Для генерации отчета 296-ФЗ необходимо заполнить дополнительные реквизиты
          </DialogDescription>
        </DialogHeader>

        {/* Список недостающих полей */}
        {missingFields.length > 0 && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <div className="font-semibold mb-2">Не заполнены обязательные поля:</div>
              <ul className="list-disc list-inside text-sm space-y-1">
                {missingFields.map((field, index) => (
                  <li key={index}>{field}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="space-y-4 py-4">
          {/* ОГРН */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="ogrn">
                ОГРН <span className="text-red-500">*</span>
              </Label>
              <Input
                id="ogrn"
                placeholder="1234567890123"
                value={formData.ogrn}
                onChange={(e) => setFormData({ ...formData, ogrn: e.target.value })}
                disabled={saving}
                maxLength={15}
              />
              <p className="text-xs text-gray-500">13 или 15 цифр</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="kpp">
                КПП <span className="text-red-500">*</span>
              </Label>
              <Input
                id="kpp"
                placeholder="773601001"
                value={formData.kpp}
                onChange={(e) => setFormData({ ...formData, kpp: e.target.value })}
                disabled={saving}
                maxLength={9}
              />
              <p className="text-xs text-gray-500">9 цифр</p>
            </div>
          </div>

          {/* ОКВЭД */}
          <div className="space-y-2">
            <Label htmlFor="okved">
              ОКВЭД (вид деятельности) <span className="text-red-500">*</span>
            </Label>
            <Input
              id="okved"
              placeholder="62.01"
              value={formData.okved}
              onChange={(e) => setFormData({ ...formData, okved: e.target.value })}
              disabled={saving}
            />
            <p className="text-xs text-gray-500">Например: 62.01 - Разработка ПО</p>
          </div>

          {/* Полное наименование */}
          <div className="space-y-2">
            <Label htmlFor="fullName">
              Полное наименование организации <span className="text-red-500">*</span>
            </Label>
            <Input
              id="fullName"
              placeholder='Общество с ограниченной ответственностью "Название"'
              value={formData.fullName}
              onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
              disabled={saving}
            />
          </div>

          {/* Юридический адрес */}
          <div className="space-y-2">
            <Label htmlFor="legalAddress">
              Юридический адрес <span className="text-red-500">*</span>
            </Label>
            <Input
              id="legalAddress"
              placeholder="г. Москва, ул. Ленина, д. 1, офис 10"
              value={formData.legalAddress}
              onChange={(e) => setFormData({ ...formData, legalAddress: e.target.value })}
              disabled={saving}
            />
          </div>

          {/* Руководитель */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="directorName">
                ФИО руководителя <span className="text-red-500">*</span>
              </Label>
              <Input
                id="directorName"
                placeholder="Иванов Иван Иванович"
                value={formData.directorName}
                onChange={(e) => setFormData({ ...formData, directorName: e.target.value })}
                disabled={saving}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="directorPosition">
                Должность руководителя <span className="text-red-500">*</span>
              </Label>
              <Input
                id="directorPosition"
                placeholder="Генеральный директор"
                value={formData.directorPosition}
                onChange={(e) => setFormData({ ...formData, directorPosition: e.target.value })}
                disabled={saving}
              />
            </div>
          </div>

          {/* Дополнительные коды (опционально) */}
          <div className="pt-4 border-t">
            <p className="text-sm font-medium mb-3 text-gray-700">
              Дополнительные коды (опционально)
            </p>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="okpo" className="text-sm">ОКПО</Label>
                <Input
                  id="okpo"
                  placeholder="12345678"
                  value={formData.okpo}
                  onChange={(e) => setFormData({ ...formData, okpo: e.target.value })}
                  disabled={saving}
                  maxLength={10}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="oktmo" className="text-sm">ОКТМО</Label>
                <Input
                  id="oktmo"
                  placeholder="12345678"
                  value={formData.oktmo}
                  onChange={(e) => setFormData({ ...formData, oktmo: e.target.value })}
                  disabled={saving}
                  maxLength={11}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="okato" className="text-sm">ОКАТО</Label>
                <Input
                  id="okato"
                  placeholder="12345678"
                  value={formData.okato}
                  onChange={(e) => setFormData({ ...formData, okato: e.target.value })}
                  disabled={saving}
                  maxLength={11}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-between items-center pt-4 border-t">
          <Button
            variant="ghost"
            onClick={() => {
              window.location.href = '/settings?tab=organization';
            }}
            disabled={saving}
            className="text-[#1dc962] hover:text-[#1dc962]/90 hover:bg-[#1dc962]/10"
          >
            Перейти в настройки
          </Button>
          <div className="flex space-x-2">
            <Button variant="outline" onClick={onClose} disabled={saving}>
              Отмена
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving || !formData.ogrn || !formData.kpp || !formData.okved || !formData.fullName || !formData.legalAddress || !formData.directorName || !formData.directorPosition}
              className="bg-[#1dc962] hover:bg-[#1dc962]/90"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Сохранение...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  Сохранить и создать отчет
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
