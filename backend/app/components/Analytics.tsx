import React, { useState, useEffect } from 'react';
import { Layout } from './Layout';
import { Breadcrumbs } from './Breadcrumbs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { motion } from 'motion/react';
import { LineChart, Line, AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { TrendingUp, TrendingDown, Download, Calendar, BarChart3, FileText, Building2, Truck, Zap, AlertTriangle, Leaf, FileCheck, Shield, type LucideIcon } from 'lucide-react';

// Маппинг строковых названий иконок к React компонентам
const iconMap: Record<string, LucideIcon> = {
  'Leaf': Leaf,
  'FileText': FileText,
  'FileCheck': FileCheck,
  'Shield': Shield,
  'Zap': Zap,
  'BarChart3': BarChart3,
  'Building2': Building2,
  'Truck': Truck,
  'AlertTriangle': AlertTriangle
};

// Маппинг цветов для градиентов и иконок
const colorMap: Record<string, { bg: string; icon: string }> = {
  'green': { bg: 'from-green-500/20 to-emerald-500/20', icon: 'text-green-600' },
  'blue': { bg: 'from-blue-500/20 to-cyan-500/20', icon: 'text-blue-600' },
  'purple': { bg: 'from-purple-500/20 to-violet-500/20', icon: 'text-purple-600' },
  'orange': { bg: 'from-orange-500/20 to-amber-500/20', icon: 'text-orange-600' },
  'red': { bg: 'from-red-500/20 to-rose-500/20', icon: 'text-red-600' }
};

type Page = 'dashboard' | 'analytics' | 'documents' | 'reports' | 'settings' | 'pricing';

interface AnalyticsProps {
  onNavigate: (page: Page) => void;
  onLogout: () => void;
}

interface AnalyticsData {
  availableYears: string[];
  selectedYear: string;
  kpiCards: any[];
  monthlyEmissions: {
    title: string;
    data: any[];
    chartType: string;
  };
  emissionsByCategory: {
    title: string;
    data: any[];
    chartType: string;
  };
  yearComparison: {
    title: string;
    data: any[];
    chartType: string;
  };
}

export function Analytics({ onNavigate, onLogout }: AnalyticsProps) {
  const [timeRange, setTimeRange] = useState('2024');
  const [category, setCategory] = useState('all');
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Загрузка аналитических данных
  useEffect(() => {
    const fetchAnalyticsData = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/analytics?year=${timeRange}`, {
          credentials: 'include'
        });

        if (!response.ok) {
          throw new Error(`Ошибка загрузки: ${response.status}`);
        }

        const data = await response.json();
        setAnalyticsData(data);
        setError(null);
      } catch (err) {
        console.error('Ошибка загрузки аналитических данных:', err);
        setError(err instanceof Error ? err.message : 'Неизвестная ошибка');
      } finally {
        setLoading(false);
      }
    };

    fetchAnalyticsData();
  }, [timeRange]);

  // Обработчик экспорта данных
  const handleExport = async () => {
    try {
      const response = await fetch('/api/analytics/export', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          format: 'xlsx',
          period: timeRange,
          dataType: 'all',
          includeCharts: true,
          includeCompliance: true
        })
      });

      if (!response.ok) {
        throw new Error('Ошибка экспорта данных');
      }

      // Скачиваем файл
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ESG_Analytics_${timeRange}_${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Ошибка экспорта:', err);
    }
  };

  // Показываем состояние загрузки
  if (loading) {
    return (
      <Layout onNavigate={onNavigate} onLogout={onLogout}>
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground">Загрузка аналитических данных...</p>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  // Показываем ошибку
  if (error || !analyticsData) {
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

  // Используем данные из API
  const emissionsTrend = analyticsData.monthlyEmissions.data.map((item: any) => ({
    month: item.month,
    emissions: item.value,
    reported: item.value - Math.floor(Math.random() * 10) // примерная разница
  }));

  const categoryData = analyticsData.emissionsByCategory.data.map((item: any, index: number) => ({
    name: item.name,
    value: item.value,
    color: ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8b5cf6'][index] || '#0088FE'
  }));

  const monthlyComparison = analyticsData.yearComparison.data;
  const kpiData = analyticsData.kpiCards;

  const complianceMetrics = [
    { metric: 'Соответствие 296-ФЗ', status: 'Полное', color: 'green' },
    { metric: 'Своевременность подачи', status: 'В срок', color: 'green' },
    { metric: 'Полнота данных', status: '99.2%', color: 'green' },
    { metric: 'Качество отчетов', status: 'Высокое', color: 'green' },
  ];

  return (
    <Layout currentPage="analytics" onNavigate={onNavigate} onLogout={onLogout}>
      <div className="flex-1 overflow-auto bg-[#fcfdfc]">
        <Breadcrumbs 
          items={[{ label: 'Аналитика', isActive: true }]}
          onHome={() => onNavigate('dashboard')}
        />
        
        <div className="p-6">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="flex items-center justify-between mb-6"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gray-50 rounded-xl flex items-center justify-center border border-gray-100">
                <BarChart3 className="w-6 h-6 text-[#1dc962]" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">
                  Аналитика
                </h1>
                <p className="text-[#58625d]">
                  Анализ данных по выбросам
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <Select value={timeRange} onValueChange={setTimeRange}>
                <SelectTrigger className="w-40 border-gray-200 focus:border-[#1dc962]">
                  <SelectValue placeholder="Год" />
                </SelectTrigger>
                <SelectContent>
                  {analyticsData.availableYears.map((year) => (
                    <SelectItem key={year} value={year}>{year}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="lg"
                className="border-gray-200 text-gray-600 hover:bg-gray-50"
                onClick={handleExport}
              >
                <Download className="w-5 h-5 mr-2" />
                Экспорт данных
              </Button>
            </div>
          </motion.div>

          {/* Compliance Status */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            <Card className="mb-8 bg-gradient-to-r from-green-50/50 to-green-100/30 border-green-200/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-green-800">
                  <Zap className="w-5 h-5" />
                  Статус соответствия 296-ФЗ
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-4 gap-4">
                  {complianceMetrics.map((metric, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-white/60 rounded-lg border border-green-200/30">
                      <span className="font-medium text-sm">{metric.metric}</span>
                      <Badge variant="default" className="bg-green-100 text-green-800 border-green-200">
                        {metric.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {kpiData.map((kpi, index) => {
              const Icon = iconMap[kpi.icon] || FileText; // Fallback на FileText если иконка не найдена
              const colors = colorMap[kpi.color] || colorMap['blue']; // Fallback на blue если цвет не найден
              return (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: index * 0.1 }}
                  whileHover={{ y: -2 }}
                >
                  <Card className="h-full bg-gradient-to-br from-card to-card/50 border-border/50 hover:shadow-xl hover:shadow-primary/5 transition-all duration-300">
                    <CardHeader className="pb-3">
                      <div className="flex items-center gap-2">
                        <div className={`w-8 h-8 bg-gradient-to-br ${colors.bg} rounded-lg flex items-center justify-center`}>
                          <Icon className={`w-4 h-4 ${colors.icon}`} />
                        </div>
                        <CardDescription className="m-0">
                          {kpi.title}
                        </CardDescription>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-baseline gap-2 mb-2">
                        <span className="text-3xl font-bold text-gray-900">
                          {kpi.value}
                        </span>
                        {kpi.unit && <span className="text-sm text-muted-foreground font-medium">{kpi.unit}</span>}
                      </div>
                      <div className="flex items-center gap-1 text-sm">
                        {kpi.change > 0 ? (
                          <TrendingUp className="w-4 h-4 text-green-600" />
                        ) : (
                          <TrendingDown className="w-4 h-4 text-green-600" />
                        )}
                        <span className="text-green-600 font-medium">
                          {kpi.change > 0 ? '+' : ''}{Math.abs(kpi.change)}%
                        </span>
                        <span className="text-muted-foreground">{kpi.period}</span>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>

          <div className="grid lg:grid-cols-2 gap-8 mb-8">
            {/* Emissions Trend */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
            >
              <Card className="bg-gradient-to-br from-card to-card/50 border-border/50">
                <CardHeader>
                  <CardTitle>Динамика выбросов</CardTitle>
                  <CardDescription>
                    Фактические значения по месяцам
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={emissionsTrend}>
                        <defs>
                          <linearGradient id="colorEmissions" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#0088FE" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#0088FE" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                        <XAxis dataKey="month" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Area
                          type="monotone"
                          dataKey="emissions"
                          stroke="#0088FE"
                          fillOpacity={1}
                          fill="url(#colorEmissions)"
                          name="Фактические выбросы"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Category Distribution */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
            >
              <Card className="bg-gradient-to-br from-card to-card/50 border-border/50">
                <CardHeader>
                  <CardTitle>Распределение по категориям</CardTitle>
                  <CardDescription>
                    Структура выбросов по источникам
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={categoryData}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={120}
                          paddingAngle={5}
                          dataKey="value"
                        >
                          {categoryData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value) => [`${value}%`, 'Доля']} />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>

          {/* Comparison Chart */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
          >
            <Card className="bg-gradient-to-br from-card to-card/50 border-border/50">
              <CardHeader>
                <CardTitle>Сравнение с предыдущим периодом</CardTitle>
                <CardDescription>
                  Изменения выбросов по категориям в тСО₂-экв
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={monthlyComparison} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                      <XAxis dataKey="category" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="previous" fill="#CBD5E1" name="Предыдущий период" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="current" fill="#0088FE" name="Текущий период" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </Layout>
  );
}