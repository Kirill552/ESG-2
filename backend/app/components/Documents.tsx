import React, { useState, useMemo } from 'react';
import { Layout } from './Layout';
import { Breadcrumbs } from './Breadcrumbs';
import { FileUpload } from './FileUpload';
import { SkeletonLoader } from './SkeletonLoader';
import { FloatingActionButton } from './FloatingActionButton';
import { DocumentContextMenu } from './RichContextMenu';
import { DocumentsEmptyState } from './EmptyState';
import { AnimatedCounter } from './AnimatedCounter';
import { GradientProgress } from './GradientProgress';
import { SuccessParticles } from './ParticleEffect';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Checkbox } from './ui/checkbox';
import { Pagination, PaginationContent, PaginationEllipsis, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from './ui/pagination';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { 
  Upload, 
  Search, 
  Filter, 
  Download, 
  Eye, 
  Trash2, 
  FileText, 
  FileSpreadsheet, 
  Image,
  CheckCircle,
  Clock,
  AlertTriangle,
  MoreHorizontal,
  Plus,
  FolderOpen,
  Leaf,
  Share,
  Edit,
  RefreshCw,
  AlertCircle,
  Zap
} from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from './ui/dropdown-menu';

type Page = 'dashboard' | 'analytics' | 'documents' | 'reports' | 'settings' | 'pricing';

interface DocumentsProps {
  onNavigate: (page: Page) => void;
  onLogout: () => void;
}

interface Document {
  id: string;
  name: string;
  type: string;
  size: string;
  uploadDate: string;
  status: 'processed' | 'processing' | 'pending' | 'error';
  category: string;
  tags: string[];
}

export function Documents({ onNavigate, onLogout }: DocumentsProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [selectedDocs, setSelectedDocs] = useState<string[]>([]);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showSuccessParticles, setShowSuccessParticles] = useState(false);
  const [isReprocessing, setIsReprocessing] = useState(false);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);

  // Симуляция большого количества документов
  const generateDocuments = (): Document[] => {
    const documents: Document[] = [];
    const categories = ['Энергия', 'Транспорт', 'Производство', 'Отходы', 'Поставщики'];
    const statuses: Document['status'][] = ['processed', 'processing', 'pending', 'error'];
    const fileTypes = [
      { ext: 'xlsx', icon: FileSpreadsheet },
      { ext: 'pdf', icon: FileText },
      { ext: 'docx', icon: FileText },
      { ext: 'csv', icon: FileSpreadsheet },
      { ext: 'jpg', icon: Image }
    ];

    for (let i = 1; i <= 150; i++) {
      const category = categories[Math.floor(Math.random() * categories.length)];
      const status = statuses[Math.floor(Math.random() * statuses.length)];
      const fileType = fileTypes[Math.floor(Math.random() * fileTypes.length)];
      
      documents.push({
        id: `doc-${i}`,
        name: `${category}_данные_${i}.${fileType.ext}`,
        type: fileType.ext,
        size: `${(Math.random() * 50 + 1).toFixed(1)} МБ`,
        uploadDate: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toLocaleDateString('ru-RU'),
        status,
        category,
        tags: [`Category${i % 7 + 1}`, `Type${i % 4 + 1}`, `Year${2023 + (i % 3)}`].slice(0, Math.floor(Math.random() * 2) + 1)
      });
    }
    
    return documents.sort((a, b) => new Date(b.uploadDate).getTime() - new Date(a.uploadDate).getTime());
  };

  const [documents] = useState(generateDocuments());

  const filteredDocuments = documents.filter(doc => {
    const matchesSearch = doc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         doc.category.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || doc.status === statusFilter;
    const matchesCategory = categoryFilter === 'all' || doc.category === categoryFilter;
    
    return matchesSearch && matchesStatus && matchesCategory;
  });

  // Pagination calculations
  const totalPages = Math.ceil(filteredDocuments.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentDocuments = filteredDocuments.slice(startIndex, endIndex);

  // Error documents count
  const errorDocuments = documents.filter(doc => doc.status === 'error');
  
  // Reset to first page when filters change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter, categoryFilter, itemsPerPage]);

  const getFileIcon = (type: string) => {
    switch (type) {
      case 'xlsx':
      case 'csv':
        return FileSpreadsheet;
      case 'pdf':
      case 'docx':
        return FileText;
      case 'jpg':
      case 'png':
        return Image;
      default:
        return FileText;
    }
  };

  const getStatusBadge = (status: Document['status']) => {
    switch (status) {
      case 'processed':
        return <Badge className="bg-[#1dc962] hover:bg-[#1dc962] text-white border-0">Обработан</Badge>;
      case 'processing':
        return <Badge className="bg-blue-100 hover:bg-blue-100 text-blue-700 border-0">Загружен</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-100 hover:bg-yellow-100 text-yellow-700 border-0">В обработке</Badge>;
      case 'error':
        return <Badge className="bg-red-100 hover:bg-red-100 text-red-700 border-0">Ошибка</Badge>;
    }
  };

  const getStatusIcon = (status: Document['status']) => {
    switch (status) {
      case 'processed':
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'processing':
        return <Clock className="w-4 h-4 text-blue-600" />;
      case 'pending':
        return <Clock className="w-4 h-4 text-orange-600" />;
      case 'error':
        return <AlertTriangle className="w-4 h-4 text-red-600" />;
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedDocs(currentDocuments.map(doc => doc.id));
    } else {
      setSelectedDocs([]);
    }
  };

  const handleSelectAllErrors = () => {
    const errorDocIds = errorDocuments.map(doc => doc.id);
    setSelectedDocs(errorDocIds);
    setStatusFilter('error');
    setCurrentPage(1);
    toast.success(`Выбрано ${errorDocIds.length} документов с ошибками`);
  };

  const handleReprocessSelected = async () => {
    if (selectedDocs.length === 0) {
      toast.error('Выберите документы для повторной обработки');
      return;
    }

    setIsReprocessing(true);
    
    try {
      // Имитация повторной обработки
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Обновляем статус выбранных документов на "processing"
      // В реальном приложении здесь был бы API вызов
      
      setShowSuccessParticles(true);
      toast.success(`Запущена повторная обработка ${selectedDocs.length} документов`);
      setSelectedDocs([]);
    } catch (error) {
      toast.error('Ошибка при запуске повторной обработки');
    } finally {
      setIsReprocessing(false);
    }
  };

  const handleSelectDoc = (docId: string, checked: boolean) => {
    if (checked) {
      setSelectedDocs([...selectedDocs, docId]);
    } else {
      setSelectedDocs(selectedDocs.filter(id => id !== docId));
    }
  };

  const handleDocumentAction = (action: string, docName: string) => {
    setShowSuccessParticles(true);
    
    switch (action) {
      case 'view':
        toast.success(`Открыт документ: ${docName}`);
        break;
      case 'download':
        toast.success(`Загружен документ: ${docName}`);
        break;
      case 'edit':
        toast.success(`Начато редактирование: ${docName}`);
        break;
      case 'delete':
        toast.success(`Удален документ: ${docName}`);
        break;
      case 'share':
        toast.success(`Поделились документом: ${docName}`);
        break;
      default:
        toast.success(`Действие выполнено для: ${docName}`);
    }
  };

  const handleBulkAction = (action: string) => {
    setIsLoading(true);
    
    setTimeout(() => {
      setIsLoading(false);
      setShowSuccessParticles(true);
      
      switch (action) {
        case 'download':
          toast.success(`Загружено ${selectedDocs.length} документов`);
          break;
        case 'delete':
          toast.success(`Удалено ${selectedDocs.length} документов`);
          setSelectedDocs([]);
          break;
        default:
          toast.success(`Действие выполнено для ${selectedDocs.length} документов`);
      }
    }, 1500);
  };

  return (
    <Layout currentPage="documents" onNavigate={onNavigate} onLogout={onLogout}>
      <div className="flex-1 overflow-auto bg-[#fcfdfc]">
        <Breadcrumbs 
          items={[{ label: 'Документы', isActive: true }]}
          onHome={() => onNavigate('dashboard')}
        />
        
        <div className="p-6 pt-0">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="flex items-center justify-between mb-8"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gray-50 rounded-xl flex items-center justify-center border border-gray-100">
                <FolderOpen className="w-6 h-6 text-gray-600" />
              </div>
              <div>
                <h1 className="text-3xl font-bold mb-1 text-gray-900">
                  Управление документами
                </h1>
                <p className="text-gray-600">
                  Загружайте и управляйте документами для отчетности
                </p>
              </div>
            </div>
            
            <div className="flex gap-3">
              <Button variant="outline" size="lg" className="border-gray-200 hover:bg-gray-50 text-gray-700">
                <Download className="w-4 h-4 mr-2" />
                Экспорт
              </Button>
              <Button 
                size="lg"
                onClick={() => setIsUploadOpen(true)}
                className="bg-[#1dc962] hover:bg-[#1dc962]/90 text-white border-0 shadow-sm"
              >
                <Plus className="w-4 h-4 mr-2" />
                Загрузить документ
              </Button>
            </div>
          </motion.div>

          {/* Simplified Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <Card className="bg-white border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-2xl font-bold text-gray-900">
                        <AnimatedCounter value={documents.length} />
                      </div>
                      <div className="text-sm text-gray-600">Всего документов</div>
                    </div>
                    <div className="w-10 h-10 bg-gray-50 rounded-lg flex items-center justify-center">
                      <FileText className="w-5 h-5 text-gray-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
            
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <Card className="bg-white border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-2xl font-bold text-[#1dc962]">
                        <AnimatedCounter value={documents.filter(d => d.status === 'processed').length} />
                      </div>
                      <div className="text-sm text-gray-600">Обработано</div>
                    </div>
                    <div className="w-10 h-10 bg-green-50 rounded-lg flex items-center justify-center">
                      <CheckCircle className="w-5 h-5 text-[#1dc962]" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
            
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <Card className="bg-white border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-2xl font-bold text-blue-600">
                        <AnimatedCounter value={documents.filter(d => d.status === 'processing').length} />
                      </div>
                      <div className="text-sm text-gray-600">В обработке</div>
                    </div>
                    <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
                      <Clock className="w-5 h-5 text-blue-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
            
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              <Card className="bg-white border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-2xl font-bold text-red-600">
                        <AnimatedCounter value={errorDocuments.length} />
                      </div>
                      <div className="text-sm text-gray-600">Ошибка</div>
                    </div>
                    <div className="w-10 h-10 bg-red-50 rounded-lg flex items-center justify-center">
                      <AlertTriangle className="w-5 h-5 text-red-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>

          {/* Search and Filters */}
          <Card className="mb-6 bg-white border border-gray-100 shadow-sm">
            <CardContent className="p-4">
              <div className="flex flex-col lg:flex-row gap-4">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-3 w-4 h-4 text-gray-500" />
                    <Input
                      placeholder="Поиск по названию, типу..."
                      className="pl-10 border-gray-200 focus:border-[#1dc962] focus:ring-[#1dc962]/20"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-full lg:w-48 border-gray-200 focus:border-[#1dc962]">
                    <SelectValue placeholder="Все статусы" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Все статусы</SelectItem>
                    <SelectItem value="processed">Обработан</SelectItem>
                    <SelectItem value="processing">В обработке</SelectItem>
                    <SelectItem value="pending">Ожидание</SelectItem>
                    <SelectItem value="error">Ошибка</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="w-full lg:w-48 border-gray-200 focus:border-[#1dc962]">
                    <SelectValue placeholder="Категория" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Все категории</SelectItem>
                    <SelectItem value="Энергия">Энергия</SelectItem>
                    <SelectItem value="Транспорт">Транспорт</SelectItem>
                    <SelectItem value="Производство">Производство</SelectItem>
                    <SelectItem value="Отходы">Отходы</SelectItem>
                    <SelectItem value="Поставщики">Поставщики</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={itemsPerPage.toString()} onValueChange={(value) => setItemsPerPage(Number(value))}>
                  <SelectTrigger className="w-full lg:w-24 border-gray-200 focus:border-[#1dc962]">
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
            </CardContent>
          </Card>

          {/* Bulk Actions */}
          <AnimatePresence>
            {selectedDocs.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: -20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -20, scale: 0.95 }}
                transition={{ duration: 0.3 }}
                className="mb-4"
              >
                <Card className="bg-gray-50 border border-gray-100 shadow-sm">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-sm text-gray-700">
                          Выбрано <span className="font-medium"><AnimatedCounter value={selectedDocs.length} /></span> из 5
                        </span>
                      </div>
                      <div className="flex gap-2">
                        <Button 
                          variant="outline" 
                          size="sm"
                          disabled={isLoading || isReprocessing}
                          onClick={handleReprocessSelected}
                          className="border-gray-200 hover:bg-gray-50 text-gray-700"
                        >
                          {isReprocessing ? (
                            <>
                              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                              Обрабатываем...
                            </>
                          ) : (
                            <>
                              <Zap className="w-4 h-4 mr-2" />
                              Повторная обработка
                            </>
                          )}
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm"
                          disabled={isLoading}
                          onClick={() => handleBulkAction('download')}
                          className="border-gray-200 hover:bg-gray-50 text-gray-700"
                        >
                          {isLoading ? (
                            <SkeletonLoader variant="text" lines={1} className="w-16" />
                          ) : (
                            <>
                              <Download className="w-4 h-4 mr-2" />
                              Скачать
                            </>
                          )}
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm"
                          disabled={isLoading}
                          onClick={() => handleBulkAction('delete')}
                          className="border-red-200 text-red-600 hover:bg-red-50"
                        >
                          {isLoading ? (
                            <SkeletonLoader variant="text" lines={1} className="w-16" />
                          ) : (
                            <>
                              <Trash2 className="w-4 h-4 mr-2" />
                              Удалить
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Documents Table or Empty State */}
          {filteredDocuments.length === 0 && documents.length === 0 ? (
            <DocumentsEmptyState onUpload={() => setIsUploadOpen(true)} />
          ) : filteredDocuments.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <Search className="w-16 h-16 text-muted-foreground/50 mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">Документы не найдены</h3>
                <p className="text-muted-foreground">
                  Попробуйте изменить критерии поиска или фильтры
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              <Card className="bg-white border border-gray-100 shadow-sm mb-4">
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-gray-100 bg-gray-50/50">
                          <TableHead className="w-12 py-3">
                            <Checkbox
                              checked={selectedDocs.length === currentDocuments.length && currentDocuments.length > 0}
                              onCheckedChange={handleSelectAll}
                            />
                          </TableHead>
                          <TableHead className="font-medium text-gray-700 py-3">Название документа</TableHead>
                          <TableHead className="font-medium text-gray-700 py-3">Тип</TableHead>
                          <TableHead className="font-medium text-gray-700 py-3">Дата загрузки</TableHead>
                          <TableHead className="font-medium text-gray-700 py-3">Статус</TableHead>
                          <TableHead className="font-medium text-gray-700 py-3">Действия</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        <AnimatePresence>
                          {currentDocuments.map((doc, index) => {
                          const FileIcon = getFileIcon(doc.type);
                          const isSelected = selectedDocs.includes(doc.id);
                          
                          return (
                            <motion.tr
                              key={doc.id}
                              initial={{ opacity: 0, y: 20 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -20 }}
                              transition={{ 
                                duration: 0.3,
                                delay: index * 0.02
                              }}
                              className={`
                                border-gray-50 hover:bg-gray-50/50 transition-colors
                                ${isSelected ? 'bg-green-50 border-green-100' : ''}
                              `}
                            >
                              <TableCell className="py-3">
                                <Checkbox
                                  checked={isSelected}
                                  onCheckedChange={(checked) => handleSelectDoc(doc.id, !!checked)}
                                />
                              </TableCell>
                              <TableCell className="py-3">
                                <div className="flex items-center gap-3">
                                  <FileIcon className="w-5 h-5 text-gray-600" />
                                  <div>
                                    <div className="font-medium text-gray-900">{doc.name}</div>
                                    <div className="text-sm text-gray-500">{doc.size}</div>
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell className="py-3">
                                <span className="text-gray-600 text-sm">{doc.category}</span>
                              </TableCell>
                              <TableCell className="py-3">
                                <span className="text-gray-600 text-sm">{doc.uploadDate}</span>
                              </TableCell>
                              <TableCell className="py-3">
                                <div className="flex items-center gap-2">
                                  {getStatusBadge(doc.status)}
                                </div>
                              </TableCell>
                              <TableCell className="py-3">
                                <div className="flex items-center gap-1">
                                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0 hover:bg-gray-100" onClick={() => handleDocumentAction('download', doc.name)}>
                                    <Download className="w-4 h-4 text-[#1dc962]" />
                                  </Button>
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0 hover:bg-gray-100">
                                        <MoreHorizontal className="w-4 h-4 text-gray-500" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                      <DropdownMenuItem onClick={() => handleDocumentAction('view', doc.name)}>
                                        <Eye className="w-4 h-4 mr-2" />
                                        Просмотр
                                      </DropdownMenuItem>
                                      <DropdownMenuItem onClick={() => handleDocumentAction('edit', doc.name)}>
                                        <Edit className="w-4 h-4 mr-2" />
                                        Редактировать
                                      </DropdownMenuItem>
                                      <DropdownMenuItem 
                                        className="text-red-600"
                                        onClick={() => handleDocumentAction('delete', doc.name)}
                                      >
                                        <Trash2 className="w-4 h-4 mr-2" />
                                        Удалить
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </div>
                              </TableCell>
                            </motion.tr>
                          );
                        })}
                        </AnimatePresence>
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>

              {/* Simple Pagination */}
              {totalPages > 1 && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center justify-between"
                >
                  <div className="text-gray-600 text-sm">
                    Показано <span className="font-medium">{startIndex + 1}</span> - <span className="font-medium">{Math.min(endIndex, filteredDocuments.length)}</span> из <span className="font-medium"><AnimatedCounter value={filteredDocuments.length} /></span> документов
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => currentPage > 1 && setCurrentPage(currentPage - 1)}
                      disabled={currentPage === 1}
                      className="border-gray-200 text-gray-600"
                    >
                      Предыдущая
                    </Button>
                    
                    <span className="text-sm text-gray-600 px-3">
                      Страница {currentPage} из {totalPages}
                    </span>
                    
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => currentPage < totalPages && setCurrentPage(currentPage + 1)}
                      disabled={currentPage === totalPages}
                      className="border-gray-200 text-gray-600"
                    >
                      Следующая
                    </Button>
                  </div>
                </motion.div>
              )}
            </>
          )}
        </div>
      </div>
      
      <FileUpload 
        isOpen={isUploadOpen} 
        onClose={() => setIsUploadOpen(false)} 
      />
      
      {/* Floating Action Button */}
      <FloatingActionButton
        icon={<Leaf />}
        onClick={() => setIsUploadOpen(true)}
        tooltip="Быстрая загрузка документов"
        variant="eco"
        position="bottom-right"
      />
      
      {/* Success Particles */}
      <SuccessParticles
        show={showSuccessParticles}
        onComplete={() => setShowSuccessParticles(false)}
      />
    </Layout>
  );
}