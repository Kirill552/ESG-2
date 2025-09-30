import React from 'react';
import { Layout } from './Layout';
import { Breadcrumbs } from './Breadcrumbs';
import { AnimatedCounter, EcoMetricCounter } from './AnimatedCounter';
import { GradientProgress, ReportProgress } from './GradientProgress';
import { FloatingActionButton } from './FloatingActionButton';
import { EcoParticles } from './ParticleEffect';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Progress } from './ui/progress';
import { Badge } from './ui/badge';
import { motion } from 'motion/react';
import {
  TrendingUp,
  TrendingDown,
  FileText,
  Clock,
  CheckCircle,
  AlertTriangle,
  Upload,
  Eye,
  Leaf,
  BarChart3,
  FileCheck,
  Calendar,
  Plus,
  Zap,
  Shield
} from 'lucide-react';

type Page = 'dashboard' | 'analytics' | 'documents' | 'reports' | 'settings' | 'pricing';

interface DashboardProps {
  onNavigate: (page: Page) => void;
  onLogout: () => void;
}

interface DashboardData {
  kpiCards: any[];
  recentDocuments: any[];
  recentReports: any[];
  progress296FZ: {
    dataCollection: { label: string; percentage: number; color: string };
    documentProcessing: { label: string; percentage: number; color: string };
    reportGeneration: { label: string; percentage: number; color: string };
  };
}

// Маппинг строковых названий иконок на компоненты
const iconMap: Record<string, any> = {
  Leaf,
  FileText,
  FileCheck,
  Zap,
  BarChart3,
  Shield
};

export function Dashboard({ onNavigate, onLogout }: DashboardProps) {
  const [showEcoParticles, setShowEcoParticles] = React.useState(false);
  const [dashboardData, setDashboardData] = React.useState<DashboardData | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  // Загружаем данные дашборда при монтировании компонента
  React.useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/dashboard', {
          credentials: 'include'
        });

        if (!response.ok) {
          throw new Error(`Ошибка загрузки: ${response.status}`);
        }

        const data = await response.json();
        setDashboardData(data);
        setError(null);
      } catch (err) {
        console.error('Ошибка загрузки данных дашборда:', err);
        setError(err instanceof Error ? err.message : 'Неизвестная ошибка');
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  // Показываем состояние загрузки
  if (loading) {
    return (
      <Layout onNavigate={onNavigate} onLogout={onLogout}>
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground">Загрузка данных дашборда...</p>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  // Показываем ошибку
  if (error || !dashboardData) {
    return (
      <Layout onNavigate={onNavigate} onLogout={onLogout}>
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center">
              <AlertTriangle className="h-8 w-8 text-red-500 mx-auto mb-4" />
              <p className="text-red-600 mb-4">Ошибка загрузки данных: {error}</p>
              <Button onClick={() => window.location.reload()} variant="outline">
                Попробовать снова
              </Button>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  // Используем загруженные данные
  const stats = dashboardData.kpiCards;
  const recentDocuments = dashboardData.recentDocuments;
  const recentReports = dashboardData.recentReports;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'processed':
      case 'ready':
        return <Badge className="bg-[#1dc962] hover:bg-[#1dc962] text-white border-0">Готово</Badge>;
      case 'processing':
        return <Badge className="bg-blue-100 hover:bg-blue-100 text-blue-700 border-0">Обработка</Badge>;
      case 'draft':
        return <Badge className="bg-yellow-100 hover:bg-yellow-100 text-yellow-700 border-0">Черновик</Badge>;
      case 'pending':
        return <Badge className="bg-orange-100 hover:bg-orange-100 text-orange-700 border-0">Ожидание</Badge>;
      default:
        return <Badge className="bg-gray-100 hover:bg-gray-100 text-gray-700 border-0">{status}</Badge>;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'processed':
      case 'ready':
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'processing':
        return <Clock className="w-4 h-4 text-blue-600" />;
      case 'pending':
        return <AlertTriangle className="w-4 h-4 text-orange-600" />;
      default:
        return <FileText className="w-4 h-4 text-muted-foreground" />;
    }
  };

  return (
    <Layout currentPage="dashboard" onNavigate={onNavigate} onLogout={onLogout}>
      <div className="flex-1 overflow-auto bg-[#fcfdfc]">
        <div className="p-6">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mb-8"
          >
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 bg-gray-50 rounded-xl flex items-center justify-center border border-gray-100">
                <Leaf className="w-6 h-6 text-[#1dc962]" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">
                  Дашборд
                </h1>
                <p className="text-[#58625d]">
                  Обзор данных по выбросам парниковых газов
                </p>
              </div>
            </div>
          </motion.div>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {stats.map((stat, index) => {
              const IconComponent = typeof stat.icon === 'string' ? iconMap[stat.icon] : stat.icon;
              
              return (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: index * 0.1 }}
                  whileHover={{ scale: 1.02 }}
                  onClick={() => stat.metric === 'co2' && setShowEcoParticles(true)}
                  className="cursor-pointer"
                >
                  <Card className="bg-white border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="w-10 h-10 bg-gray-50 rounded-lg flex items-center justify-center">
                          <IconComponent className="w-5 h-5 text-[#1dc962]" />
                        </div>
                        <div className="flex items-center gap-1 text-sm">
                          {stat.change > 0 ? (
                            <TrendingUp className="w-4 h-4 text-[#1dc962]" />
                          ) : (
                            <TrendingDown className="w-4 h-4 text-red-500" />
                          )}
                          <span className={stat.change > 0 ? 'text-[#1dc962] font-medium' : 'text-red-500 font-medium'}>
                            {Math.abs(stat.change)}%
                          </span>
                        </div>
                      </div>
                      <div className="mb-1">
                        <div className="text-2xl font-bold text-gray-900">
                          {stat.metric === 'co2' ? (
                            <EcoMetricCounter value={stat.value} metric="co2" />
                          ) : (
                            <AnimatedCounter value={stat.value} suffix={` ${stat.unit}`} />
                          )}
                        </div>
                      </div>
                      <div className="text-sm text-[#58625d]">
                        {stat.title}
                      </div>
                      <div className="text-xs text-gray-400 mt-1">
                        {stat.period}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>

          <div className="grid lg:grid-cols-2 gap-6">
            {/* Recent Documents */}
            <Card className="bg-white border border-gray-100 shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <div>
                  <CardTitle className="text-lg font-semibold text-gray-900">Последние документы</CardTitle>
                  <CardDescription className="text-[#58625d]">Недавно загруженные файлы</CardDescription>
                </div>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => onNavigate('documents')}
                  className="border-gray-200 text-gray-600 hover:bg-gray-50"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Загрузить
                </Button>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {recentDocuments.map((doc, index) => (
                    <div key={index} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                      <div className="flex items-center gap-3">
                        {getStatusIcon(doc.status)}
                        <div>
                          <p className="font-medium text-sm text-gray-900">{doc.name}</p>
                          <p className="text-xs text-[#58625d]">{doc.date}</p>
                        </div>
                      </div>
                      {getStatusBadge(doc.status)}
                    </div>
                  ))}
                </div>
                <Button 
                  variant="ghost" 
                  className="w-full mt-4 text-[#58625d] hover:bg-gray-50"
                  onClick={() => onNavigate('documents')}
                >
                  Показать все документы
                </Button>
              </CardContent>
            </Card>

            {/* Recent Reports */}
            <Card className="bg-white border border-gray-100 shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <div>
                  <CardTitle className="text-lg font-semibold text-gray-900">Отчеты</CardTitle>
                  <CardDescription className="text-[#58625d]">Созданные отчеты о выбросах</CardDescription>
                </div>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => onNavigate('reports')}
                  className="border-gray-200 text-gray-600 hover:bg-gray-50"
                >
                  <Eye className="w-4 h-4 mr-2" />
                  Создать
                </Button>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {recentReports.map((report, index) => (
                    <div key={index} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                      <div className="flex items-center gap-3">
                        {getStatusIcon(report.status)}
                        <div>
                          <p className="font-medium text-sm text-gray-900">{report.name}</p>
                          <p className="text-xs text-[#58625d]">{report.date}</p>
                        </div>
                      </div>
                      {getStatusBadge(report.status)}
                    </div>
                  ))}
                </div>
                <Button 
                  variant="ghost" 
                  className="w-full mt-4 text-[#58625d] hover:bg-gray-50"
                  onClick={() => onNavigate('reports')}
                >
                  Все отчеты
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Progress Overview */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.6 }}
          >
            <Card className="mt-6 bg-white border border-gray-100 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg font-semibold text-gray-900">
                  <BarChart3 className="w-5 h-5 text-[#1dc962]" />
                  Прогресс отчетности
                </CardTitle>
                <CardDescription className="text-[#58625d]">
                  Выполнение требований 296-ФЗ
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-700">{dashboardData.progress296FZ.dataCollection.label}</span>
                      <span className="text-gray-500">{dashboardData.progress296FZ.dataCollection.percentage}%</span>
                    </div>
                    <Progress value={dashboardData.progress296FZ.dataCollection.percentage} className="h-2" />
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-700">{dashboardData.progress296FZ.documentProcessing.label}</span>
                      <span className="text-gray-500">{dashboardData.progress296FZ.documentProcessing.percentage}%</span>
                    </div>
                    <Progress value={dashboardData.progress296FZ.documentProcessing.percentage} className="h-2" />
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-700">{dashboardData.progress296FZ.reportGeneration.label}</span>
                      <span className="text-gray-500">{dashboardData.progress296FZ.reportGeneration.percentage}%</span>
                    </div>
                    <Progress value={dashboardData.progress296FZ.reportGeneration.percentage} className="h-2" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
      
      {/* Floating Action Button */}
      <FloatingActionButton
        icon={<Plus />}
        onClick={() => onNavigate('documents')}
        tooltip="Быстрое создание отчета"
        variant="eco"
        position="bottom-right"
      />
      
      {/* Eco Particles */}
      <EcoParticles
        show={showEcoParticles}
        onComplete={() => setShowEcoParticles(false)}
      />
    </Layout>
  );
}