import React, { useState, useCallback } from 'react';
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
  Plus
} from 'lucide-react';
import { Button } from './ui/button';
import { Progress } from './ui/progress';
import { Badge } from './ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';

interface FileWithProgress {
  file: File;
  id: string;
  progress: number;
  status: 'uploading' | 'success' | 'error' | 'pending';
  error?: string;
}

interface FileUploadProps {
  isOpen: boolean;
  onClose: () => void;
}

export function FileUpload({ isOpen, onClose }: FileUploadProps) {
  const [files, setFiles] = useState<FileWithProgress[]>([]);
  const [isDragging, setIsDragging] = useState(false);

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
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selected = Array.from(e.target.files);
      addFiles(selected);
    }
  };

  const addFiles = (newFiles: File[]) => {
    const filesWithProgress: FileWithProgress[] = newFiles.map(file => ({
      file,
      id: Math.random().toString(36).substr(2, 9),
      progress: 0,
      status: 'pending' as const
    }));
    
    setFiles(prev => [...prev, ...filesWithProgress]);
    
    // Симуляция загрузки
    filesWithProgress.forEach(fileItem => {
      setTimeout(() => {
        uploadFile(fileItem);
      }, Math.random() * 1000);
    });
  };

  const uploadFile = (fileItem: FileWithProgress) => {
    setFiles(prev => prev.map(f => 
      f.id === fileItem.id ? { ...f, status: 'uploading' } : f
    ));

    // Симуляция прогресса загрузки
    let progress = 0;
    const interval = setInterval(() => {
      progress += Math.random() * 30;
      if (progress >= 100) {
        progress = 100;
        clearInterval(interval);
        
        // Симуляция успеха/ошибки
        const isSuccess = Math.random() > 0.1; // 90% успеха
        
        setFiles(prev => prev.map(f => 
          f.id === fileItem.id 
            ? { 
                ...f, 
                progress: 100, 
                status: isSuccess ? 'success' : 'error',
                error: isSuccess ? undefined : 'Ошибка загрузки файла'
              } 
            : f
        ));
      } else {
        setFiles(prev => prev.map(f => 
          f.id === fileItem.id ? { ...f, progress } : f
        ));
      }
    }, 200);
  };

  const removeFile = (id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Б';
    const k = 1024;
    const sizes = ['Б', 'КБ', 'МБ', 'ГБ'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const getStatusColor = (status: FileWithProgress['status']) => {
    switch (status) {
      case 'success': return 'text-green-600';
      case 'error': return 'text-red-600';
      case 'uploading': return 'text-blue-600';
      default: return 'text-muted-foreground';
    }
  };

  const getStatusIcon = (status: FileWithProgress['status']) => {
    switch (status) {
      case 'success': return CheckCircle;
      case 'error': return AlertTriangle;
      case 'uploading': return Loader2;
      default: return Upload;
    }
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
          className="w-full max-w-4xl max-h-[80vh] overflow-hidden"
        >
          <Card className="border-border/50 shadow-2xl">
            <CardHeader className="border-b border-border/50 bg-gradient-to-r from-card to-muted/20">
              <div className="flex items-center justify-between">
                <CardTitle className="text-2xl">Загрузка документов</CardTitle>
                <Button variant="ghost" size="icon" onClick={onClose}>
                  <X className="w-5 h-5" />
                </Button>
              </div>
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
                    ? 'border-primary bg-primary/5 scale-[1.02]' 
                    : 'border-border hover:border-primary/50 hover:bg-muted/30'
                  }
                `}
              >
                <div className="flex flex-col items-center gap-4">
                  <div className="w-16 h-16 bg-gradient-to-br from-primary/20 to-primary/10 rounded-2xl flex items-center justify-center">
                    <Upload className="w-8 h-8 text-primary" />
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
                    <p className="text-muted-foreground">
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
                            className="flex items-center gap-4 p-4 bg-muted/30 rounded-lg border border-border/50"
                          >
                            <div className="w-10 h-10 bg-card rounded-lg flex items-center justify-center border border-border/50">
                              <FileIcon className="w-5 h-5 text-muted-foreground" />
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
                                  >
                                    <X className="w-4 h-4" />
                                  </Button>
                                </div>
                              </div>
                              
                              <div className="flex items-center gap-4">
                                <span className="text-sm text-muted-foreground">
                                  {formatFileSize(fileItem.file.size)}
                                </span>
                                
                                {fileItem.status === 'uploading' && (
                                  <div className="flex-1">
                                    <Progress value={fileItem.progress} className="h-2" />
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

                  <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-border/50">
                    <Button variant="outline" onClick={onClose}>
                      Отмена
                    </Button>
                    <Button 
                      onClick={onClose}
                      disabled={files.some(f => f.status === 'uploading')}
                    >
                      Готово
                    </Button>
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