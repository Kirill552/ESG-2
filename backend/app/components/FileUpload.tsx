import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Upload, X, Plus } from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { useToast } from '@/lib/hooks/use-toast';

interface FileUploadProps {
  isOpen: boolean;
  onClose: () => void;
  onUploadComplete?: () => void; // Callback для обновления списка документов
}

export function FileUpload({ isOpen, onClose, onUploadComplete }: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const { toast } = useToast();


  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const dropped = Array.from(e.dataTransfer.files);
    if (dropped.length === 0) return;

    // Закрываем модальное окно сразу
    onClose();

    // Показываем toast уведомление о начале загрузки
    toast({
      title: "Загрузка началась",
      description: `${dropped.length} ${dropped.length === 1 ? 'файл' : dropped.length < 5 ? 'файла' : 'файлов'} загружается...`,
    });

    // Загружаем файлы напрямую через FormData
    try {
      for (const file of dropped) {
        const formData = new FormData();
        formData.append('file', file);
        // undefined = автоматическое определение категории

        await fetch('/api/documents/upload', {
          method: 'POST',
          credentials: 'include',
          body: formData,
        });
      }

      // Показываем успешное уведомление
      toast({
        title: "Загрузка завершена",
        description: `Успешно загружено ${dropped.length} ${dropped.length === 1 ? 'файл' : dropped.length < 5 ? 'файла' : 'файлов'}. Документы отправлены на обработку.`,
      });

      // Обновляем список документов
      onUploadComplete?.();
    } catch (error) {
      toast({
        title: "Ошибка загрузки",
        description: error instanceof Error ? error.message : "Произошла ошибка",
        variant: "destructive",
      });
    }
  }, [onClose, toast, onUploadComplete]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;

    const selected = Array.from(e.target.files);

    // Закрываем модальное окно сразу
    onClose();

    // Показываем toast уведомление о начале загрузки
    toast({
      title: "Загрузка началась",
      description: `${selected.length} ${selected.length === 1 ? 'файл' : selected.length < 5 ? 'файла' : 'файлов'} загружается...`,
    });

    // Загружаем файлы напрямую через FormData
    try {
      for (const file of selected) {
        const formData = new FormData();
        formData.append('file', file);
        // undefined = автоматическое определение категории

        await fetch('/api/documents/upload', {
          method: 'POST',
          credentials: 'include',
          body: formData,
        });
      }

      // Показываем успешное уведомление
      toast({
        title: "Загрузка завершена",
        description: `Успешно загружено ${selected.length} ${selected.length === 1 ? 'файл' : selected.length < 5 ? 'файла' : 'файлов'}. Документы отправлены на обработку.`,
      });

      // Обновляем список документов
      onUploadComplete?.();
    } catch (error) {
      toast({
        title: "Ошибка загрузки",
        description: error instanceof Error ? error.message : "Произошла ошибка",
        variant: "destructive",
      });
    }

    // Очищаем input для возможности повторной загрузки тех же файлов
    e.target.value = '';
  };


  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          onClick={e => e.stopPropagation()}
          className="w-full max-w-2xl"
        >
          <Card className="bg-white border-gray-200 shadow-2xl">
            <CardHeader className="border-b border-gray-200 bg-gradient-to-r from-white to-gray-50/20">
              <div className="flex items-center justify-between">
                <CardTitle className="text-2xl">Загрузка документов</CardTitle>
                <Button variant="ghost" size="icon" onClick={onClose}>
                  <X className="w-5 h-5" />
                </Button>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                Файлы загрузятся автоматически. Категории будут определены с помощью ИИ.
              </p>
            </CardHeader>

            <CardContent className="p-6">
              {/* Drop Zone */}
              <motion.div
                onDrop={handleDrop}
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                whileHover={{ scale: 1.01 }}
                className={`
                  relative border-2 border-dashed rounded-xl p-12 text-center transition-all duration-300
                  ${isDragging
                    ? 'border-[#1dc962] bg-[#1dc962]/5 scale-[1.02]'
                    : 'border-gray-300 hover:border-[#1dc962]/50 hover:bg-gray-50'
                  }
                `}
              >
                <div className="flex flex-col items-center gap-4">
                  <div className="w-16 h-16 bg-gradient-to-br from-[#1dc962]/20 to-[#1dc962]/10 rounded-2xl flex items-center justify-center">
                    <Upload className="w-8 h-8 text-[#1dc962]" />
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold mb-2">
                      Перетащите файлы сюда или
                    </h3>
                    <Button
                      variant="outline"
                      size="lg"
                      className="mb-4"
                      onClick={() => fileInputRef.current?.click()}
                      type="button"
                    >
                      <Plus className="w-5 h-5 mr-2" />
                      Выберите файлы
                    </Button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      onChange={handleFileSelect}
                      className="hidden"
                      accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.jpg,.jpeg,.png"
                    />
                    <p className="text-sm text-gray-500 mt-2">
                      Поддерживаются: PDF, DOC, DOCX, XLS, XLSX, CSV, TXT, JPG, PNG
                    </p>
                    <p className="text-sm text-gray-500 mt-1">
                      Максимум 20 файлов, до 50 МБ каждый
                    </p>
                  </div>
                </div>
              </motion.div>
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}