import React, { useState } from 'react';
import { Layout } from './Layout';
import { Breadcrumbs } from './Breadcrumbs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { motion } from 'motion/react';
import { LineChart, Line, AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { TrendingUp, TrendingDown, Download, Calendar, BarChart3, FileText, Building2, Truck, Zap } from 'lucide-react';

type Page = 'dashboard' | 'analytics' | 'documents' | 'reports' | 'settings' | 'pricing';

interface AnalyticsProps {
  onNavigate: (page: Page) => void;
  onLogout: () => void;
}

export function Analytics({ onNavigate, onLogout }: AnalyticsProps) {
  const [timeRange, setTimeRange] = useState('year');
  const [category, setCategory] = useState('all');

  // Данные для отчетности по 296-ФЗ
  const emissionsTrend = [
    { month: 'Янв', emissions: 120, reported: 118 },
    { month: 'Фев', emissions: 115, reported: 116 },
    { month: 'Мар', emissions: 135, reported: 133 },
    { month: 'Апр', emissions: 108, reported: 109 },
    { month: 'Май', emissions: 102, reported: 101 },
    { month: 'Июн', emissions: 98, reported: 97 },
    { month: 'Июл', emissions: 105, reported: 104 },
    { month: 'Авг', emissions: 95, reported: 94 },
    { month: 'Сен', emissions: 88, reported: 87 },
    { month: 'Окт', emissions: 92, reported: 91 },
    { month: 'Ноя', emissions: 85, reported: 84 },
    { month: 'Дек', emissions: 80, reported: 79 },
  ];

  const categoryData = [
    { name: 'Энергия', value: 45, color: '#0088FE' },
    { name: 'Транспорт', value: 25, color: '#00C49F' },
    { name: 'Производство', value: 20, color: '#FFBB28' },
    { name: 'Отходы', value: 10, color: '#FF8042' },
  ];

  const monthlyComparison = [
    { category: 'Энергия', current: 45, previous: 52 },
    { category: 'Транспорт', current: 25, previous: 28 },
    { category: 'Производство', current: 20, previous: 18 },
    { category: 'Отходы', current: 10, previous: 12 },
  ];

  const reportingData = [
    { year: '2023', reported: 1580, documents: 89 },
    { year: '2024', reported: 1247, documents: 156 },
    { year: '2025', reported: 0, documents: 12 },
  ];

  const kpiData = [
    {
      title: 'Общие выбросы',
      value: '1,247',
      unit: 'тСО₂-экв',
      change: -21.1,
      period: 'к прошлому году',
      status: 'positive',
      icon: BarChart3,
      color: 'from-blue-500/20 to-blue-600/20',
      iconColor: 'text-blue-600'
    },
    {
      title: 'Точность отчетов',
      value: '99.2%',
      change: 2.1,
      period: 'за квартал',
      status: 'positive',
      icon: FileText,
      color: 'from-green-500/20 to-green-600/20',
      iconColor: 'text-green-600'
    },
    {
      title: 'Обработано документов',
      value: '156',
      unit: 'файлов',
      change: 75.3,
      period: 'к прошлому году',
      status: 'positive',
      icon: FileText,
      color: 'from-purple-500/20 to-purple-600/20',
      iconColor: 'text-purple-600'
    },
    {
      title: 'Готовность отчетов',
      value: '23',
      unit: 'отчета',
      change: 15.0,
      period: 'за период',
      status: 'positive',
      icon: Building2,
      color: 'from-orange-500/20 to-orange-600/20',
      iconColor: 'text-orange-600'
    }
  ];

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
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="month">Месяц</SelectItem>
                  <SelectItem value="quarter">Квартал</SelectItem>
                  <SelectItem value="year">Год</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" size="lg" className="border-gray-200 text-gray-600 hover:bg-gray-50">
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
              const Icon = kpi.icon;
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
                        <div className={`w-8 h-8 bg-gradient-to-br ${kpi.color} rounded-lg flex items-center justify-center`}>
                          <Icon className={`w-4 h-4 ${kpi.iconColor}`} />
                        </div>
                        <CardDescription className="m-0">
                          {kpi.title}
                        </CardDescription>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-baseline gap-2 mb-2">
                        <span className="text-3xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
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
                    Фактические и заявленные значения по месяцам
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
                          <linearGradient id="colorReported" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#00C49F" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#00C49F" stopOpacity={0}/>
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
                        <Area 
                          type="monotone" 
                          dataKey="reported" 
                          stroke="#00C49F" 
                          fillOpacity={1} 
                          fill="url(#colorReported)"
                          name="Заявленные выбросы"
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