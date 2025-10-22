'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Checkbox } from './ui/checkbox';
import { ScrollArea } from './ui/scroll-area';
import { Card } from './ui/card';
import { Separator } from './ui/separator';
import {
  Brain,
  CheckCircle2,
  Fuel,
  MapPin,
  Gauge,
  Calculator,
  Edit,
  Info,
  AlertTriangle
} from 'lucide-react';

interface TransportDocumentsGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  transportDocsCount: number;
}

export function TransportDocumentsGuideModal({
  isOpen,
  onClose,
  transportDocsCount
}: TransportDocumentsGuideModalProps) {
  const [dontShowAgain, setDontShowAgain] = useState(false);

  const handleClose = () => {
    if (dontShowAgain) {
      localStorage.setItem('hideTransportGuide', 'true');
    }
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" />
            Как работает ИИ-анализ транспортных документов
          </DialogTitle>
          <DialogDescription>
            Система автоматически дополняет недостающие данные для расчета выбросов CO₂
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh]">
          <div className="space-y-6 pr-4">
            {/* Что делает ИИ */}
            <div className="space-y-3">
              <h3 className="font-semibold flex items-center gap-2 text-green-700">
                <CheckCircle2 className="h-5 w-5" />
                Что определяется автоматически
              </h3>
              <div className="grid gap-3">
                <Card className="p-3 bg-green-50 border-green-200">
                  <div className="flex items-start gap-3">
                    <Fuel className="h-5 w-5 text-green-700 mt-0.5" />
                    <div>
                      <p className="font-medium text-sm">Тип топлива</p>
                      <p className="text-xs text-muted-foreground">
                        По марке автомобиля (бензин/дизель). Точность ~85%
                      </p>
                    </div>
                  </div>
                </Card>

                <Card className="p-3 bg-green-50 border-green-200">
                  <div className="flex items-start gap-3">
                    <MapPin className="h-5 w-5 text-green-700 mt-0.5" />
                    <div>
                      <p className="font-medium text-sm">Расстояние маршрута</p>
                      <p className="text-xs text-muted-foreground">
                        Между городами по федеральным трассам. Погрешность ±50 км (1-3%)
                      </p>
                    </div>
                  </div>
                </Card>

                <Card className="p-3 bg-green-50 border-green-200">
                  <div className="flex items-start gap-3">
                    <Gauge className="h-5 w-5 text-green-700 mt-0.5" />
                    <div>
                      <p className="font-medium text-sm">Расход топлива</p>
                      <p className="text-xs text-muted-foreground">
                        Типовые нормы по модели транспорта (л/100 км)
                      </p>
                    </div>
                  </div>
                </Card>
              </div>
            </div>

            <Separator />

            {/* Пример расчета */}
            <div className="space-y-3">
              <h3 className="font-semibold flex items-center gap-2 text-blue-700">
                <Calculator className="h-5 w-5" />
                Пример расчета
              </h3>
              <Card className="p-4 bg-blue-50 border-blue-200">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Автомобиль:</span>
                    <span className="font-medium">ГАЗель Т 223 НМ 196 RUS</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Маршрут:</span>
                    <span className="font-medium">Екатеринбург → Москва</span>
                  </div>
                  <Separator className="my-2" />
                  <div className="flex justify-between text-blue-700">
                    <span>Тип топлива (ИИ):</span>
                    <span className="font-semibold">Дизель (85% уверенность)</span>
                  </div>
                  <div className="flex justify-between text-blue-700">
                    <span>Расстояние (ИИ):</span>
                    <span className="font-semibold">1781 км</span>
                  </div>
                  <div className="flex justify-between text-blue-700">
                    <span>Расход (типовой):</span>
                    <span className="font-semibold">12.5 л/100 км</span>
                  </div>
                  <Separator className="my-2" />
                  <div className="flex justify-between font-bold text-blue-900">
                    <span>Выбросы CO₂:</span>
                    <span>~500 кг</span>
                  </div>
                </div>
              </Card>
            </div>

            <Separator />

            {/* Как уточнить */}
            <div className="space-y-3">
              <h3 className="font-semibold flex items-center gap-2 text-orange-700">
                <Edit className="h-5 w-5" />
                Когда и как уточнять данные
              </h3>
              <p className="text-sm text-muted-foreground">
                При создании отчета в разделе "Отчеты" появится окно для проверки
                и корректировки данных. Система сгруппирует документы по автомобилям
                и маршрутам, чтобы вы ввели данные один раз для всех похожих документов.
              </p>

              <Card className="p-3 bg-orange-50 border-orange-200">
                <p className="text-sm">
                  <strong>💡 Совет:</strong> Если у вас есть путевые листы с точными
                  данными (расход топлива, пробег), укажите их при создании отчета
                  для расчета с точностью 100%.
                </p>
              </Card>
            </div>

            <Separator />

            {/* Соответствие 296-ФЗ */}
            <div className="space-y-3">
              <h3 className="font-semibold flex items-center gap-2">
                <Info className="h-5 w-5" />
                Соответствие 296-ФЗ
              </h3>
              <p className="text-sm text-muted-foreground">
                Расчеты выполняются по коэффициентам из <strong>Приказа Минприроды №371</strong>:
              </p>
              <ul className="text-sm space-y-1 ml-6 list-disc text-muted-foreground">
                <li>Бензин: 2.31 т CO₂/т топлива</li>
                <li>Дизель: 2.67 т CO₂/т топлива</li>
              </ul>
              <Card className="p-3 bg-muted">
                <p className="text-xs text-muted-foreground">
                  <AlertTriangle className="h-3 w-3 inline mr-1" />
                  Погрешность определения типа топлива и расстояния (1-3%) допустима
                  для отчетности по 296-ФЗ, т.к. ГИС Энергоэффективность не проверяет
                  каждую поездку, а только итоговые суммы выбросов.
                </p>
              </Card>
            </div>
          </div>
        </ScrollArea>

        <DialogFooter>
          <div className="flex items-center gap-2 mr-auto">
            <Checkbox
              id="dont-show-transport-guide"
              checked={dontShowAgain}
              onCheckedChange={(checked) => setDontShowAgain(checked as boolean)}
            />
            <label
              htmlFor="dont-show-transport-guide"
              className="text-sm cursor-pointer"
            >
              Больше не показывать
            </label>
          </div>
          <Button onClick={handleClose}>
            Понятно
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
