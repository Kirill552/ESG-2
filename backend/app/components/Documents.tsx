import React, { useState, useMemo } from 'react';
import { Layout } from './Layout';
import { Breadcrumbs } from './Breadcrumbs';
import { FileUpload } from './FileUpload';
import { FloatingActionButton } from './FloatingActionButton';
import { DocumentsEmptyState } from './EmptyState';
import { AnimatedCounter } from './AnimatedCounter';
import { SuccessParticles } from './ParticleEffect';
import { DocumentsTable } from './DocumentsTable';
import { TransportDocumentsGuideModal } from './TransportDocumentsGuideModal';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import { motion } from 'motion/react';
import { useDocuments } from '@/lib/hooks/useDocuments';
import { useToast } from '@/lib/hooks/use-toast';
import {
  Download,
  Plus,
  FolderOpen,
  Leaf,
  FileText,
  CheckCircle,
  Clock,
  AlertTriangle,
  AlertCircle,
  ChevronRight,
  RotateCw
} from 'lucide-react';

type Page = 'dashboard' | 'analytics' | 'documents' | 'reports' | 'settings' | 'pricing';

interface DocumentsProps {
  onNavigate: (page: Page) => void;
  onLogout: () => void;
}

export function Documents({ onNavigate, onLogout }: DocumentsProps) {
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [showSuccessParticles, setShowSuccessParticles] = useState(false);
  const [showTransportGuide, setShowTransportGuide] = useState(false);
  const { toast } = useToast();

  const {
    documents,
    pagination,
    stats,
    loading,
    error,
    refresh
  } = useDocuments({
    initialFilters: {
      pageSize: 25,
      page: 1
    }
  });

  // Определяем наличие транспортных документов
  const hasTransportDocuments = useMemo(() => {
    if (!documents || documents.length === 0) return false;
    return documents.some(doc => doc.category === 'Транспорт');
  }, [documents]);

  const transportDocsCount = useMemo(() => {
    if (!documents) return 0;
    return documents.filter(doc => doc.category === 'Транспорт').length;
  }, [documents]);

  const handleUploadComplete = () => {
    setShowSuccessParticles(true);
    refresh();
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

          {/* Stats Cards */}
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
                        <AnimatedCounter value={stats?.total || 0} />
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
                        <AnimatedCounter value={stats?.processed || 0} />
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
                        <AnimatedCounter value={stats?.processing || 0} />
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
                        <AnimatedCounter value={stats?.failed || 0} />
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

          {/* Transport Documents Warning Button */}
          {hasTransportDocuments && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="mb-4"
            >
              <Button
                variant="outline"
                size="sm"
                className="gap-2 bg-amber-50 border-amber-300 text-amber-900 hover:bg-amber-100 hover:border-amber-400 transition-all"
                onClick={() => setShowTransportGuide(true)}
              >
                <AlertCircle className="h-4 w-4" />
                <span className="font-medium">Важно: ИИ-расчеты</span>
                <ChevronRight className="h-3 w-3 ml-1" />
              </Button>
            </motion.div>
          )}

          {/* Documents Table */}
          {(!documents || documents.length === 0) && !loading ? (
            <DocumentsEmptyState onUpload={() => setIsUploadOpen(true)} />
          ) : (
            <DocumentsTable />
          )}
        </div>
      </div>

      <FileUpload
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        onUploadComplete={handleUploadComplete}
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

      {/* Transport Documents Guide Modal */}
      <TransportDocumentsGuideModal
        isOpen={showTransportGuide}
        onClose={() => setShowTransportGuide(false)}
        transportDocsCount={transportDocsCount}
      />
    </Layout>
  );
}