'use client';

import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ChevronDown,
  ChevronUp,
  Download,
  Trash2,
  RefreshCw,
  FileText,
  MoreHorizontal,
  Search,
  Filter,
  Eye,
  Edit,
  Share,
  CheckCircle,
  AlertTriangle,
  Loader2,
  Clock,
  Tag
} from 'lucide-react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Checkbox } from './ui/checkbox';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from './ui/dropdown-menu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './ui/table';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { useDocuments, Document } from '@/lib/hooks/useDocuments';
import { useToast } from '@/lib/hooks/use-toast';
import OcrResultModal from './OcrResultModal';
import { getFileTypeLabel } from '@/lib/file-type-labels';

interface DocumentsTableProps {
  className?: string;
}

export function DocumentsTable({ className = '' }: DocumentsTableProps) {
  const [selectedDocuments, setSelectedDocuments] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [sortOrder, setSortOrder] = useState('createdAt_desc');
  const [pageSize, setPageSize] = useState(25);
  const [ocrModalOpen, setOcrModalOpen] = useState(false);
  const [selectedOcrDocument, setSelectedOcrDocument] = useState<{ id: string; name: string } | null>(null);
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);

  const { toast } = useToast();

  const {
    documents,
    pagination,
    stats,
    filters,
    sorting,
    loading,
    error,
    refresh,
    setFilters,
    downloadDocument,
    deleteDocument,
    reprocessDocuments,
    bulkAction,
  } = useDocuments({
    initialFilters: {
      q: searchQuery,
      status: statusFilter,
      category: categoryFilter,
      order: sortOrder,
      pageSize,
    },
  });

  // Обработчики
  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
    setFilters({ q: query, page: 1 });
  }, [setFilters]);

  const handleStatusFilter = useCallback((status: string) => {
    setStatusFilter(status);
    setFilters({ status, page: 1 });
  }, [setFilters]);

  const handleCategoryFilter = useCallback((category: string) => {
    setCategoryFilter(category);
    setFilters({ category, page: 1 });
  }, [setFilters]);

  const handleSort = useCallback((order: string) => {
    setSortOrder(order);
    setFilters({ order, page: 1 });
  }, [setFilters]);

  const handlePageSize = useCallback((size: number) => {
    setPageSize(size);
    setFilters({ pageSize: size, page: 1 });
  }, [setFilters]);

  const handlePageChange = useCallback((page: number) => {
    setFilters({ page });
  }, [setFilters]);

  const handleSelectDocument = useCallback((id: string, checked: boolean) => {
    setSelectedDocuments(prev =>
      checked ? [...prev, id] : prev.filter(docId => docId !== id)
    );
  }, []);

  const handleSelectAll = useCallback((checked: boolean) => {
    setSelectedDocuments(checked ? documents.map(doc => doc.id) : []);
  }, [documents]);

  const handleDownload = useCallback(async (document: Document) => {
    try {
      await downloadDocument(document.id, document.displayName);
      toast({
        title: "Загрузка начата",
        description: `Файл ${document.displayName} загружается`,
      });
    } catch (error) {
      toast({
        title: "Ошибка загрузки",
        description: error instanceof Error ? error.message : "Произошла ошибка",
        variant: "destructive",
      });
    }
  }, [downloadDocument, toast]);

  const handleDelete = useCallback(async (document: Document) => {
    if (window.confirm(`Удалить документ "${document.displayName}"?`)) {
      try {
        await deleteDocument(document.id);
        toast({
          title: "Документ удален",
          description: `${document.displayName} успешно удален`,
        });
      } catch (error) {
        toast({
          title: "Ошибка удаления",
          description: error instanceof Error ? error.message : "Произошла ошибка",
          variant: "destructive",
        });
      }
    }
  }, [deleteDocument, toast]);

  const handleBulkAction = useCallback(async (action: string) => {
    if (selectedDocuments.length === 0) return;

    try {
      const result = await bulkAction(action, selectedDocuments);
      toast({
        title: "Операция выполнена",
        description: result.message,
      });
      setSelectedDocuments([]);
    } catch (error) {
      toast({
        title: "Ошибка операции",
        description: error instanceof Error ? error.message : "Произошла ошибка",
        variant: "destructive",
      });
    }
  }, [bulkAction, selectedDocuments, toast]);

  const handleReprocess = useCallback(async (documentIds?: string[]) => {
    try {
      const ids = documentIds || selectedDocuments;
      if (ids.length === 0) return;

      const result = await reprocessDocuments(ids);
      toast({
        title: "Распознавание запущено",
        description: result.message,
      });
      if (!documentIds) setSelectedDocuments([]);
    } catch (error) {
      toast({
        title: "Ошибка распознавания",
        description: error instanceof Error ? error.message : "Произошла ошибка",
        variant: "destructive",
      });
    }
  }, [reprocessDocuments, selectedDocuments, toast]);

  const handleViewOcr = useCallback((document: Document) => {
    setSelectedOcrDocument({ id: document.id, name: document.displayName });
    setOcrModalOpen(true);
  }, []);

  const handleCloseOcrModal = useCallback(() => {
    setOcrModalOpen(false);
    setSelectedOcrDocument(null);
  }, []);

  const handleChangeCategory = useCallback(async (newCategory: string) => {
    if (selectedDocuments.length === 0) return;

    try {
      const response = await fetch('/api/documents/update-category', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentIds: selectedDocuments,
          category: newCategory
        })
      });

      if (!response.ok) {
        throw new Error('Не удалось обновить категорию');
      }

      const result = await response.json();
      toast({
        title: "Категория обновлена",
        description: `Категория изменена для ${selectedDocuments.length} документов`,
      });

      setSelectedDocuments([]);
      setCategoryModalOpen(false);
      refresh();
    } catch (error) {
      toast({
        title: "Ошибка обновления категории",
        description: error instanceof Error ? error.message : "Произошла ошибка",
        variant: "destructive",
      });
    }
  }, [selectedDocuments, toast, refresh]);

  // Компоненты статусов
  const StatusBadge = ({ status, metadata }: { status: string; metadata: any }) => (
    <Badge
      variant="outline"
      className="text-xs"
      style={{
        color: metadata.color,
        backgroundColor: metadata.bgColor,
        borderColor: metadata.color + '40',
      }}
    >
      <span className="mr-1">{metadata.icon}</span>
      {metadata.label}
    </Badge>
  );

  const CategoryBadge = ({ category, metadata }: { category: string; metadata: any }) => (
    <Badge
      variant="outline"
      className="text-xs"
      style={{
        color: metadata.color,
        backgroundColor: metadata.bgColor,
        borderColor: metadata.color + '40',
      }}
    >
      <span className="mr-1">{metadata.icon}</span>
      {metadata.label}
    </Badge>
  );

  const ProgressBar = ({ progress, status }: { progress: number; status: string }) => {
    if (status !== 'PROCESSING') return null;

    return (
      <div className="w-full bg-gray-200 rounded-full h-1.5 mt-1">
        <div
          className="bg-blue-500 h-1.5 rounded-full transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>
    );
  };

  if (error) {
    return (
      <Card className={className}>
        <CardContent className="flex items-center justify-center py-8">
          <div className="text-center">
            <AlertTriangle className="w-8 h-8 text-red-500 mx-auto mb-2" />
            <p className="text-red-600">{error}</p>
            <Button variant="outline" onClick={refresh} className="mt-2">
              <RefreshCw className="w-4 h-4 mr-2" />
              Повторить
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl">Документы</CardTitle>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={refresh} disabled={loading}>
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>

        {/* Фильтры и поиск */}
        <div className="flex flex-col sm:flex-row gap-4 mt-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Поиск документов..."
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          <Select value={statusFilter} onValueChange={handleStatusFilter}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Все статусы" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все статусы</SelectItem>
              {filters?.statuses.map((status) => (
                <SelectItem key={status.value} value={status.value}>
                  <span className="mr-2">{status.icon}</span>
                  {status.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={categoryFilter} onValueChange={handleCategoryFilter}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Все категории" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все категории</SelectItem>
              {filters?.categories.map((category) => (
                <SelectItem key={category.value} value={category.value}>
                  <span className="mr-2">{category.icon}</span>
                  {category.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={sortOrder} onValueChange={handleSort}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Сортировка" />
            </SelectTrigger>
            <SelectContent>
              {sorting?.available.map((sort) => (
                <SelectItem key={sort.value} value={sort.value}>
                  {sort.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Массовые действия */}
        {selectedDocuments.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-2 p-3 bg-blue-50 rounded-lg mt-4"
          >
            <span className="text-sm text-blue-700">
              Выбрано {selectedDocuments.length} документов
            </span>
            <div className="flex gap-2 ml-auto">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setCategoryModalOpen(true)}
              >
                <Tag className="w-4 h-4 mr-1" />
                Категория
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleReprocess()}
              >
                <RefreshCw className="w-4 h-4 mr-1" />
                Распознать
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleBulkAction('export')}
              >
                <Download className="w-4 h-4 mr-1" />
                Экспорт
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleBulkAction('delete')}
              >
                <Trash2 className="w-4 h-4 mr-1" />
                Удалить
              </Button>
            </div>
          </motion.div>
        )}
      </CardHeader>

      <CardContent>
        {loading && documents.length === 0 ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin mr-2" />
            Загрузка документов...
          </div>
        ) : documents.length === 0 ? (
          <div className="text-center py-8">
            <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Документы не найдены</h3>
            <p className="text-gray-600">
              {searchQuery || statusFilter || categoryFilter
                ? 'Попробуйте изменить критерии поиска'
                : 'Загрузите первый документ для начала работы'}
            </p>
          </div>
        ) : (
          <>
            {/* Таблица */}
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={selectedDocuments.length === documents.length}
                        onCheckedChange={(checked) => handleSelectAll(!!checked)}
                      />
                    </TableHead>
                    <TableHead>Название</TableHead>
                    <TableHead className="w-24">Тип</TableHead>
                    <TableHead>Размер</TableHead>
                    <TableHead>Статус</TableHead>
                    <TableHead>Категория</TableHead>
                    <TableHead>Дата загрузки</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <AnimatePresence>
                    {documents.map((document) => (
                      <motion.tr
                        key={document.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="group hover:bg-gray-50"
                      >
                        <TableCell>
                          <Checkbox
                            checked={selectedDocuments.includes(document.id)}
                            onCheckedChange={(checked) =>
                              handleSelectDocument(document.id, !!checked)
                            }
                          />
                        </TableCell>

                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div
                              className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm font-medium"
                              style={{ backgroundColor: document.fileTypeMetadata.color }}
                            >
                              {document.fileTypeMetadata.icon}
                            </div>
                            <div className="min-w-0">
                              <p className="font-medium truncate max-w-[200px]">
                                {document.displayName}
                              </p>
                              <p className="text-sm text-gray-500 truncate">
                                {document.fileTypeMetadata.name}
                              </p>
                              <ProgressBar
                                progress={document.progressPercent}
                                status={document.status}
                              />
                            </div>
                          </div>
                        </TableCell>

                        <TableCell>
                          <div className="text-sm font-medium text-gray-700">
                            {getFileTypeLabel(document.fileType)}
                          </div>
                        </TableCell>

                        <TableCell>
                          <span className="text-sm text-gray-600">
                            {document.formattedFileSize}
                          </span>
                        </TableCell>

                        <TableCell>
                          <StatusBadge
                            status={document.status}
                            metadata={document.statusMetadata}
                          />
                          {document.processingMessage && (
                            <p className="text-xs text-gray-500 mt-1 max-w-[150px] truncate">
                              {document.processingMessage}
                            </p>
                          )}
                        </TableCell>

                        <TableCell>
                          <CategoryBadge
                            category={document.category}
                            metadata={document.categoryMetadata}
                          />
                        </TableCell>

                        <TableCell>
                          <div className="text-sm text-gray-600">
                            {new Date(document.createdAt).toLocaleDateString('ru-RU')}
                          </div>
                          <div className="text-xs text-gray-500">
                            {new Date(document.createdAt).toLocaleTimeString('ru-RU', {
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </div>
                        </TableCell>

                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="w-8 h-8">
                                <MoreHorizontal className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="bg-white border shadow-lg">
                              <DropdownMenuItem onClick={() => handleDownload(document)}>
                                <Download className="w-4 h-4 mr-2" />
                                Скачать
                              </DropdownMenuItem>
                              {(document.status === 'PROCESSED' || document.status === 'FAILED') && (
                                <DropdownMenuItem onClick={() => handleViewOcr(document)}>
                                  <Eye className="w-4 h-4 mr-2" />
                                  Просмотр OCR
                                </DropdownMenuItem>
                              )}
                              {document.hasError && (
                                <DropdownMenuItem onClick={() => handleReprocess([document.id])}>
                                  <RefreshCw className="w-4 h-4 mr-2" />
                                  Распознать
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => handleDelete(document)}
                                className="text-red-600"
                              >
                                <Trash2 className="w-4 h-4 mr-2" />
                                Удалить
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </motion.tr>
                    ))}
                  </AnimatePresence>
                </TableBody>
              </Table>
            </div>

            {/* Пагинация */}
            {pagination && pagination.pages > 1 && (
              <div className="flex items-center justify-between mt-6">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <span>
                    Показано {pagination.startIndex}-{pagination.endIndex} из {pagination.total}
                  </span>
                  <Select value={pageSize.toString()} onValueChange={(value) => handlePageSize(Number(value))}>
                    <SelectTrigger className="w-20 h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="10">10</SelectItem>
                      <SelectItem value="25">25</SelectItem>
                      <SelectItem value="50">50</SelectItem>
                      <SelectItem value="100">100</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(pagination.page - 1)}
                    disabled={!pagination.hasPrev}
                  >
                    Предыдущая
                  </Button>

                  <div className="flex items-center gap-1">
                    {(() => {
                      const currentPage = pagination.page;
                      const totalPages = pagination.pages;
                      const maxVisible = 7; // Максимальное количество видимых кнопок
                      const pages: (number | string)[] = [];

                      if (totalPages <= maxVisible) {
                        // Показываем все страницы если их мало
                        for (let i = 1; i <= totalPages; i++) {
                          pages.push(i);
                        }
                      } else {
                        // Умная пагинация для большого количества страниц
                        pages.push(1); // Всегда показываем первую страницу

                        if (currentPage > 3) {
                          pages.push('...'); // Многоточие слева
                        }

                        // Показываем текущую страницу и соседние
                        const start = Math.max(2, currentPage - 1);
                        const end = Math.min(totalPages - 1, currentPage + 1);

                        for (let i = start; i <= end; i++) {
                          pages.push(i);
                        }

                        if (currentPage < totalPages - 2) {
                          pages.push('...'); // Многоточие справа
                        }

                        pages.push(totalPages); // Всегда показываем последнюю страницу
                      }

                      return pages.map((page, idx) => {
                        if (page === '...') {
                          return (
                            <span key={`ellipsis-${idx}`} className="px-2 text-gray-400">
                              ...
                            </span>
                          );
                        }

                        return (
                          <Button
                            key={page}
                            variant={page === currentPage ? "default" : "outline"}
                            size="sm"
                            className="w-8 h-8 p-0"
                            onClick={() => handlePageChange(page as number)}
                          >
                            {page}
                          </Button>
                        );
                      });
                    })()}
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(pagination.page + 1)}
                    disabled={!pagination.hasNext}
                  >
                    Следующая
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>

      {/* OCR Result Modal */}
      {selectedOcrDocument && (
        <OcrResultModal
          isOpen={ocrModalOpen}
          onClose={handleCloseOcrModal}
          documentId={selectedOcrDocument.id}
          documentName={selectedOcrDocument.name}
        />
      )}

      {/* Category Selection Modal */}
      {categoryModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-lg shadow-xl max-w-md w-full p-6"
          >
            <h3 className="text-lg font-semibold mb-4">
              Изменить категорию
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              Выбрано документов: {selectedDocuments.length}
            </p>

            <div className="space-y-2 mb-6">
              {filters?.categories.map((category) => (
                <Button
                  key={category.value}
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => handleChangeCategory(category.value)}
                >
                  <span className="mr-2">{category.icon}</span>
                  {category.label}
                </Button>
              ))}
            </div>

            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setCategoryModalOpen(false)}
              >
                Отмена
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </Card>
  );
}