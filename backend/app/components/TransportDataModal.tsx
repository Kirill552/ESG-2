'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  Fuel,
  Calendar,
  Gauge,
  MapPin,
  Truck,
  Info,
  Loader2,
  CheckCircle,
  AlertTriangle
} from 'lucide-react';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { Input } from './ui/input';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';
import { useToast } from '@/lib/hooks/use-toast';

interface TransportData {
  vehicle: {
    model: string;
    licensePlate?: string;
    fuelType?: {
      fuelType: 'diesel' | 'gasoline' | 'gas';
      confidence: number;
      reasoning?: string;
    };
  };
  route: {
    from?: string;
    to?: string;
    distance?: {
      distance: number;
      distanceSource?: string;
      confidence?: number;
    };
  };
  emissions?: number;
  fuelConsumed?: number;
  hasOverride: boolean;
  userOverride?: {
    fuelType?: string;
    yearOfManufacture?: number;
    actualConsumption?: number;
  };
}

interface TransportDataModalProps {
  isOpen: boolean;
  onClose: () => void;
  documentId: string;
  documentName: string;
  onUpdate?: () => void;
}

export function TransportDataModal({
  isOpen,
  onClose,
  documentId,
  documentName,
  onUpdate
}: TransportDataModalProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [data, setData] = useState<TransportData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [fuelType, setFuelType] = useState<'diesel' | 'gasoline' | 'gas'>('gasoline');
  const [yearOfManufacture, setYearOfManufacture] = useState<string>('');
  const [actualConsumption, setActualConsumption] = useState<string>('');

  const { toast } = useToast();

  // Загрузка данных при открытии модалки
  useEffect(() => {
    if (!isOpen || !documentId) return;

    const fetchData = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/documents/${documentId}/transport-override`, {
          credentials: 'include'
        });

        if (!response.ok) {
          throw new Error('Не удалось загрузить данные документа');
        }

        const result = await response.json();

        if (result.ok && result.data) {
          setData(result.data);

          // Устанавливаем начальные значения формы
          const currentFuel = result.data.userOverride?.fuelType ||
                            result.data.vehicle?.fuelType?.fuelType ||
                            'gasoline';
          setFuelType(currentFuel);

          if (result.data.userOverride?.yearOfManufacture) {
            setYearOfManufacture(result.data.userOverride.yearOfManufacture.toString());
          }

          if (result.data.userOverride?.actualConsumption) {
            setActualConsumption(result.data.userOverride.actualConsumption.toString());
          }
        } else {
          throw new Error('Некорректный ответ сервера');
        }
      } catch (err) {
        console.error('Failed to fetch transport data:', err);
        setError(err instanceof Error ? err.message : 'Произошла ошибка');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [isOpen, documentId]);

  const handleSave = async () => {
    setSaving(true);

    try {
      const payload: any = { fuelType };

      if (yearOfManufacture) {
        const year = parseInt(yearOfManufacture, 10);
        if (isNaN(year) || year < 1990 || year > new Date().getFullYear() + 1) {
          toast({
            title: "Ошибка валидации",
            description: "Укажите корректный год выпуска",
            variant: "destructive"
          });
          setSaving(false);
          return;
        }
        payload.yearOfManufacture = year;
      }

      if (actualConsumption) {
        const consumption = parseFloat(actualConsumption);
        if (isNaN(consumption) || consumption <= 0 || consumption > 100) {
          toast({
            title: "Ошибка валидации",
            description: "Укажите корректный расход топлива (0-100 л/100км)",
            variant: "destructive"
          });
          setSaving(false);
          return;
        }
        payload.actualConsumption = consumption;
      }

      const response = await fetch(`/api/documents/${documentId}/transport-override`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Не удалось обновить данные');
      }

      const result = await response.json();

      toast({
        title: "Данные обновлены",
        description: `Выбросы пересчитаны: ${(result.recalculatedEmissions || 0).toFixed(3)} т CO₂`,
      });

      // Обновляем UI
      if (onUpdate) {
        onUpdate();
      }

      onClose();
    } catch (err) {
      console.error('Failed to update transport data:', err);
      toast({
        title: "Ошибка обновления",
        description: err instanceof Error ? err.message : 'Произошла ошибка',
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    if (!saving) {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <Truck className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-gray-900">
                  Уточнение транспортных данных
                </h2>
                <p className="text-sm text-gray-600 mt-0.5 max-w-md truncate">
                  {documentName}
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleClose}
              disabled={saving}
            >
              <X className="w-5 h-5" />
            </Button>
          </div>

          {/* Content */}
          <div className="p-6 overflow-y-auto max-h-[calc(90vh-180px)]">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-green-600" />
                <span className="ml-3 text-gray-600">Загрузка данных...</span>
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center py-12">
                <AlertTriangle className="w-12 h-12 text-red-500 mb-4" />
                <p className="text-red-600 text-center">{error}</p>
                <Button variant="outline" onClick={handleClose} className="mt-4">
                  Закрыть
                </Button>
              </div>
            ) : data ? (
              <div className="space-y-6">
                {/* Информация о транспорте */}
                <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <Truck className="w-4 h-4 text-gray-600" />
                    <span className="font-medium text-gray-900">
                      {data.vehicle.model}
                      {data.vehicle.licensePlate && `, ${data.vehicle.licensePlate}`}
                    </span>
                  </div>
                  {data.route.from && data.route.to && (
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <MapPin className="w-4 h-4" />
                      <span>
                        {data.route.from} → {data.route.to}
                        {data.route.distance && ` (${data.route.distance.distance} км)`}
                      </span>
                    </div>
                  )}
                </div>

                {/* Текущий тип топлива */}
                {data.vehicle.fuelType && !data.hasOverride && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-start gap-2">
                      <Info className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                      <div className="text-sm">
                        <p className="text-blue-900 font-medium mb-1">
                          Текущий выбор: {
                            data.vehicle.fuelType.fuelType === 'diesel' ? 'Дизель' :
                            data.vehicle.fuelType.fuelType === 'gasoline' ? 'Бензин' : 'Газ'
                          }
                        </p>
                        <p className="text-blue-700">
                          Определено AI ({Math.round(data.vehicle.fuelType.confidence * 100)}% уверенность)
                        </p>
                        {data.vehicle.fuelType.reasoning && (
                          <p className="text-blue-600 text-xs mt-1">
                            {data.vehicle.fuelType.reasoning}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Форма уточнения */}
                <div className="space-y-4">
                  <div>
                    <Label className="text-base font-medium flex items-center gap-2 mb-3">
                      <Fuel className="w-4 h-4" />
                      Тип топлива *
                    </Label>
                    <RadioGroup value={fuelType} onValueChange={(v: any) => setFuelType(v)}>
                      <div className="space-y-2">
                        <div className="flex items-center space-x-2 border rounded-lg p-3 hover:bg-gray-50 cursor-pointer">
                          <RadioGroupItem value="gasoline" id="gasoline" />
                          <Label htmlFor="gasoline" className="flex-1 cursor-pointer">
                            Бензин (АИ-92, АИ-95, АИ-98)
                          </Label>
                        </div>
                        <div className="flex items-center space-x-2 border rounded-lg p-3 hover:bg-gray-50 cursor-pointer">
                          <RadioGroupItem value="diesel" id="diesel" />
                          <Label htmlFor="diesel" className="flex-1 cursor-pointer">
                            Дизель (ДТ)
                          </Label>
                        </div>
                        <div className="flex items-center space-x-2 border rounded-lg p-3 hover:bg-gray-50 cursor-pointer">
                          <RadioGroupItem value="gas" id="gas" />
                          <Label htmlFor="gas" className="flex-1 cursor-pointer">
                            Газ (СПГ/КПГ)
                          </Label>
                        </div>
                      </div>
                    </RadioGroup>
                  </div>

                  <div>
                    <Label htmlFor="year" className="text-base font-medium flex items-center gap-2 mb-2">
                      <Calendar className="w-4 h-4" />
                      Год выпуска (опционально)
                    </Label>
                    <Input
                      id="year"
                      type="number"
                      min="1990"
                      max={new Date().getFullYear() + 1}
                      value={yearOfManufacture}
                      onChange={(e) => setYearOfManufacture(e.target.value)}
                      placeholder="Например: 2018"
                      className="max-w-xs"
                    />
                    <p className="text-sm text-gray-500 mt-1 flex items-center gap-1">
                      <Info className="w-3 h-3" />
                      Поможет точнее определить расход топлива
                    </p>
                  </div>

                  <div>
                    <Label htmlFor="consumption" className="text-base font-medium flex items-center gap-2 mb-2">
                      <Gauge className="w-4 h-4" />
                      Фактический расход (опционально)
                    </Label>
                    <div className="flex items-center gap-2 max-w-xs">
                      <Input
                        id="consumption"
                        type="number"
                        min="0"
                        max="100"
                        step="0.1"
                        value={actualConsumption}
                        onChange={(e) => setActualConsumption(e.target.value)}
                        placeholder="12.5"
                      />
                      <span className="text-gray-600">л/100км</span>
                    </div>
                    <p className="text-sm text-gray-500 mt-1 flex items-center gap-1">
                      <Info className="w-3 h-3" />
                      Если известен из путевого листа
                    </p>
                  </div>
                </div>

                {/* Предварительный расчет */}
                {data.route.distance && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <h3 className="font-medium text-green-900 mb-2 flex items-center gap-2">
                      <CheckCircle className="w-4 h-4" />
                      Предварительный расчет
                    </h3>
                    <div className="space-y-1 text-sm text-green-800">
                      <p>• Расстояние: {data.route.distance.distance} км ({data.route.distance.distanceSource || 'StarLine Maps'})</p>
                      {data.fuelConsumed && (
                        <p>• Потребление: {data.fuelConsumed.toFixed(1)} л</p>
                      )}
                      {data.emissions && (
                        <p className="font-medium">• Выбросы CO₂: {data.emissions.toFixed(3)} тонн</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ) : null}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 p-6 border-t bg-gray-50">
            <Button
              variant="outline"
              onClick={handleClose}
              disabled={saving}
            >
              Отмена
            </Button>
            <Button
              onClick={handleSave}
              disabled={loading || saving}
              className="bg-green-600 hover:bg-green-700"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Сохранение...
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Сохранить и пересчитать
                </>
              )}
            </Button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
