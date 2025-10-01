import React, { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Upload,
  X,
  FileText,
  FileSpreadsheet,
  Image,
  CheckCircle,
  AlertTriangle,
  Loader2,
  Plus,
  RefreshCw
} from 'lucide-react';
import { Button } from './ui/button';
import { Progress } from './ui/progress';
import { Badge } from './ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { useFileUpload } from '@/lib/hooks/useFileUpload';
import { useToast } from '@/lib/hooks/use-toast';

interface FileUploadProps {
  isOpen: boolean;
  onClose: () => void;
  onUploadComplete?: () => void; // Callback для обновления списка документов
}

export function FileUpload({ isOpen, onClose, onUploadComplete }: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('AUTO');
  const { toast } = useToast();

  const {
    files,
    uploading,
    progress: overallProgress,
    addFiles,
    removeFile,
    clearFiles,
    uploadFiles,
    cancelUpload,
    validateFile,
  } = useFileUpload({
    maxFiles: 20,
    onUploadComplete: (uploadedFiles) => {
      toast({
        title: "Загрузка завершена",
        description: `Успешно загружено ${uploadedFiles.length} файлов. Документы отправлены на обработку.`,
      });
      onUploadComplete?.();
      // Закрываем модальное окно после успешной загрузки
      setTimeout(() => {
        onClose();
      }, 1500); // Даем время увидеть уведомление
    },
    onUploadError: (file, error) => {
      toast({
        title: "Ошибка загрузки",
        description: `${file.file.name}: ${error}`,
        variant: "destructive",
      });
    },
  });

  // Сброс файлов при закрытии модалки
  useEffect(() => {
    if (!isOpen) {
      clearFiles();
      setSelectedCategory('AUTO');
    }
  }, [isOpen, clearFiles]);

  const getFileIcon = (filename: string) => {
    const ext = filename.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'pdf':
      case 'doc':
      case 'docx':
      case 'txt':
        return FileText;
      case 'xls':
      case 'xlsx':
      case 'csv':
        return FileSpreadsheet;
      case 'jpg':
      case 'jpeg':
      case 'png':
      case 'gif':
        return Image;
      default:
        return FileText;
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const dropped = Array.from(e.dataTransfer.files);
    addFiles(dropped);
  }, [addFiles]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selected = Array.from(e.target.files);
      addFiles(selected);
    }
  };

  const handleUpload = async () => {
    try {
      // Если выбрано "Автоматически" (AUTO), передаем undefined для автоопределения категории
      const category = selectedCategory === 'AUTO' ? undefined : selectedCategory;
      await uploadFiles(category);
    } catch (error) {
      toast({
        title: "Ошибка загрузки",
        description: error instanceof Error ? error.message : "Произошла ошибка",
        variant: "destructive",
      });
    }
  };

  const handleClose = () => {
    if (uploading) {
      cancelUpload();
    }
    onClose();
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Б';
    const k = 1024;
    const sizes = ['Б', 'КБ', 'МБ', 'ГБ'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success': return 'text-green-600';
      case 'error': return 'text-red-600';
      case 'uploading': return 'text-blue-600';
      default: return 'text-muted-foreground';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success': return CheckCircle;
      case 'error': return AlertTriangle;
      case 'uploading': return Loader2;
      default: return Upload;
    }
  };

  const categories = [
    { value: 'AUTO', label: 'Автоматически' },
    { value: 'PRODUCTION', label: '🏭 Производство' },
    { value: 'SUPPLIERS', label: '🚛 Поставщики' },
    { value: 'WASTE', label: '🗑️ Отходы' },
    { value: 'TRANSPORT', label: '🚚 Транспорт' },
    { value: 'ENERGY', label: '⚡ Энергия' },
    { value: 'OTHER', label: '📋 Другое' },
  ];

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
          className="w-full max-w-4xl max-h-[80vh] overflow-hidden"
        >
          <Card className="bg-white border-gray-200 shadow-2xl">
            <CardHeader className="border-b border-gray-200 bg-gradient-to-r from-white to-gray-50/20">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-2xl">Загрузка документов</CardTitle>
                  {files.length > 0 && (
                    <p className="text-sm text-muted-foreground mt-1">
                      {files.length} файлов • {files.filter(f => f.status === 'success').length} загружено
                      {uploading && ` • ${overallProgress}% завершено`}
                    </p>
                  )}
                </div>
                <Button variant="ghost" size="icon" onClick={handleClose}>
                  <X className="w-5 h-5" />
                </Button>
              </div>

              {files.length > 0 && (
                <div className="flex items-center gap-4 mt-4">
                  <div className="flex-1">
                    <label className="text-sm font-medium text-gray-700 mb-2 block">
                      Категория документов
                    </label>
                    <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Выберите категорию" />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map((cat) => (
                          <SelectItem key={cat.value} value={cat.value}>
                            {cat.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {uploading && (
                    <div className="flex-1">
                      <label className="text-sm font-medium text-gray-700 mb-2 block">
                        Общий прогресс
                      </label>
                      <div className="flex items-center gap-2">
                        <Progress value={overallProgress} className="flex-1" />
                        <span className="text-sm text-gray-600 min-w-[3rem]">
                          {overallProgress}%
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardHeader>
            
            <CardContent className="p-6 max-h-[60vh] overflow-y-auto">
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
                    <Button variant="outline" size="lg" className="mb-4">
                      <Plus className="w-5 h-5 mr-2" />
                      Выберите файлы
                      <input
                        type="file"
                        multiple
                        onChange={handleFileSelect}
                        className="absolute inset-0 opacity-0 cursor-pointer"
                        accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.jpg,.jpeg,.png"
                      />
                    </Button>
                    <p className="text-gray-600">
                      Поддерживаются: PDF, DOC, DOCX, XLS, XLSX, CSV, TXT, JPG, PNG
                    </p>
                  </div>
                </div>
              </motion.div>

              {/* Files List */}
              {files.length > 0 && (
                <div className="mt-6">
                  <h4 className="font-semibold mb-4 flex items-center gap-2">
                    Файлы ({files.length})
                    <Badge variant="outline">
                      {files.filter(f => f.status === 'success').length} загружено
                    </Badge>
                  </h4>
                  
                  <div className="space-y-3 max-h-80 overflow-y-auto">
                    <AnimatePresence>
                      {files.map((fileItem) => {
                        const FileIcon = getFileIcon(fileItem.file.name);
                        const StatusIcon = getStatusIcon(fileItem.status);

                        return (
                          <motion.div
                            key={fileItem.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, x: -100 }}
                            className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg border border-gray-200"
                          >
                            <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center border border-gray-200">
                              <FileIcon className="w-5 h-5 text-gray-600" />
                            </div>

                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between mb-1">
                                <p className="font-medium truncate pr-2">
                                  {fileItem.file.name}
                                </p>
                                <div className="flex items-center gap-2">
                                  <span className={`text-sm ${getStatusColor(fileItem.status)}`}>
                                    <StatusIcon className={`w-4 h-4 inline mr-1 ${
                                      fileItem.status === 'uploading' ? 'animate-spin' : ''
                                    }`} />
                                    {fileItem.status === 'success' && 'Загружено'}
                                    {fileItem.status === 'error' && 'Ошибка'}
                                    {fileItem.status === 'uploading' && 'Загрузка...'}
                                    {fileItem.status === 'pending' && 'Ожидание'}
                                  </span>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="w-6 h-6"
                                    onClick={() => removeFile(fileItem.id)}
                                    disabled={fileItem.status === 'uploading'}
                                  >
                                    <X className="w-4 h-4" />
                                  </Button>
                                </div>
                              </div>

                              <div className="flex items-center gap-4">
                                <span className="text-sm text-gray-600">
                                  {formatFileSize(fileItem.file.size)}
                                </span>

                                {fileItem.status === 'uploading' && fileItem.progress && (
                                  <div className="flex-1 flex items-center gap-2">
                                    <Progress value={fileItem.progress.percentage} className="h-2 flex-1" />
                                    <span className="text-xs text-gray-500 min-w-[2.5rem]">
                                      {Math.round(fileItem.progress.percentage)}%
                                    </span>
                                  </div>
                                )}

                                {fileItem.error && (
                                  <span className="text-sm text-red-600">
                                    {fileItem.error}
                                  </span>
                                )}
                              </div>
                            </div>
                          </motion.div>
                        );
                      })}
                    </AnimatePresence>
                  </div>

                  <div className="flex justify-between items-center mt-6 pt-4 border-t border-gray-200">
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      {files.length > 0 && (
                        <>
                          <span>
                            {files.filter(f => f.status === 'pending').length} ожидают загрузки
                          </span>
                          {files.filter(f => f.status === 'error').length > 0 && (
                            <span className="text-red-600">
                              • {files.filter(f => f.status === 'error').length} с ошибками
                            </span>
                          )}
                        </>
                      )}
                    </div>

                    <div className="flex gap-3">
                      {uploading && (
                        <Button variant="outline" onClick={cancelUpload}>
                          <X className="w-4 h-4 mr-2" />
                          Отменить загрузку
                        </Button>
                      )}

                      <Button variant="outline" onClick={handleClose}>
                        {uploading ? 'Закрыть' : 'Отмена'}
                      </Button>

                      {files.filter(f => f.status === 'pending').length > 0 && !uploading && (
                        <Button onClick={handleUpload}>
                          <Upload className="w-4 h-4 mr-2" />
                          Загрузить {files.filter(f => f.status === 'pending').length} файлов
                        </Button>
                      )}

                      {files.filter(f => f.status === 'success').length > 0 && !uploading && (
                        <Button onClick={handleClose}>
                          <CheckCircle className="w-4 h-4 mr-2" />
                          Готово
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}