import React, { useState } from 'react';
import { Layout } from './Layout';
import { Breadcrumbs } from './Breadcrumbs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Separator } from './ui/separator';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Check, 
  Star, 
  FileText, 
  Users, 
  Database, 
  BarChart3, 
  Shield, 
  Headphones,
  Zap,
  Building,
  Send,
  CreditCard,
  Mail,
  Phone,
  Calendar
} from 'lucide-react';

type Page = 'dashboard' | 'analytics' | 'documents' | 'reports' | 'settings' | 'pricing';

interface PricingProps {
  onNavigate: (page: Page) => void;
  onLogout: () => void;
}

export function Pricing({ onNavigate, onLogout }: PricingProps) {
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [formData, setFormData] = useState({
    company: '',
    name: '',
    email: '',
    phone: '',
    employees: '',
    plan: '',
    message: ''
  });

  const plans = [
    {
      id: 'starter',
      name: 'Базовый',
      description: 'Для небольших компаний',
      price: 'Пробный доступ',
      popular: false,
      color: 'from-blue-500/20 to-blue-600/20',
      iconColor: 'text-blue-600',
      features: [
        'До 50 документов в месяц',
        'Базовая аналитика по 296-ФЗ',
        '3 отчета в месяц',
        'Email поддержка',
        'Экспорт в PDF',
        'Соответствие 296-ФЗ',
        '14 дней тестирования'
      ]
    },
    {
      id: 'professional',
      name: 'Профессиональный',
      description: 'Для растущих предприятий',
      price: 'Рекомендуемый',
      popular: true,
      color: 'from-green-500/20 to-green-600/20',
      iconColor: 'text-green-600',
      features: [
        'До 500 документов в месяц',
        'Расширенная аналитика и прогнозы',
        'Неограниченное количество отчетов',
        'Приоритетная поддержка',
        'Все форматы экспорта',
        'API доступ',
        'Кастомизация отчетов',
        'Многопользовательский доступ (до 10)',
        'Персональный менеджер'
      ]
    },
    {
      id: 'enterprise',
      name: 'Корпоративный',
      description: 'Для крупных организаций',
      price: 'Индивидуальный',
      popular: false,
      color: 'from-purple-500/20 to-purple-600/20',
      iconColor: 'text-purple-600',
      features: [
        'Неограниченное количество документов',
        'ИИ-аналитика и рекомендации',
        'Выделенный менеджер',
        'Интеграция с корп. системами',
        'Кастомные отчеты и дашборды',
        'SLA 99.9%',
        'Обучение команды',
        'Неограниченные пользователи',
        'Приоритетная разработка функций'
      ]
    }
  ];

  const benefits = [
    {
      icon: Shield,
      title: '100% соответствие 296-ФЗ',
      description: 'Гарантированное соблюдение всех требований российского законодательства'
    },
    {
      icon: Zap,
      title: 'Автоматизация до 95%',
      description: 'ИИ берет на себя рутинную работу по обработке документов'
    },
    {
      icon: FileText,
      title: 'Готовые шаблоны отчетов',
      description: 'Соответствуют всем требованиям регулятора'
    },
    {
      icon: Headphones,
      title: 'Поддержка экспертов',
      description: 'Консультации по вопросам экологического права и отчетности'
    }
  ];

  const handleRequestAccess = (planId: string) => {
    setSelectedPlan(planId);
    setFormData({ ...formData, plan: planId });
    setShowRequestForm(true);
  };

  const handleSubmitRequest = (e: React.FormEvent) => {
    e.preventDefault();
    // Имитация отправки заявки
    console.log('Заявка отправлена:', formData);
    setShowRequestForm(false);
    // Здесь можно добавить уведомление об успешной отправке
  };

  return (
    <Layout currentPage="pricing" onNavigate={onNavigate} onLogout={onLogout}>
      <div className="flex-1 overflow-auto bg-[#fcfdfc]">
        <div className="p-6">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-12 bg-gray-50 rounded-xl flex items-center justify-center border border-gray-100">
              <CreditCard className="w-6 h-6 text-[#1dc962]" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Тарифы</h1>
              <p className="text-[#58625d]">
                Подберем оптимальное решение для вашей компании
              </p>
            </div>
          </div>
          
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-center mb-10"
          >
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Получите доступ к ESG-Лайт
            </h2>
            <p className="text-lg text-[#58625d] mb-6 max-w-2xl mx-auto">
              Доступ к платформе предоставляется после рассмотрения заявки. 
              Мы подберем оптимальное решение для вашей компании.
            </p>

            <div className="inline-flex items-center gap-3 px-6 py-3 bg-gray-50 rounded-lg border border-gray-200">
              <Calendar className="w-4 h-4 text-[#1dc962]" />
              <span className="text-sm font-medium text-gray-700">Рассмотрение заявки: 1-2 рабочих дня</span>
            </div>
          </motion.div>

          {/* Benefits */}
          <div className="grid md:grid-cols-4 gap-4 mb-10">
            {benefits.map((benefit, index) => {
              const Icon = benefit.icon;
              return (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: index * 0.1 }}
                  whileHover={{ y: -2 }}
                >
                  <Card className="text-center h-full bg-white border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                    <CardContent className="p-6">
                      <div className="w-12 h-12 bg-gray-50 rounded-lg flex items-center justify-center mx-auto mb-4">
                        <Icon className="w-6 h-6 text-[#1dc962]" />
                      </div>
                      <h3 className="font-semibold mb-2 text-gray-900">{benefit.title}</h3>
                      <p className="text-[#58625d] text-sm">{benefit.description}</p>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>

          {/* Plans Grid */}
          <div className="grid lg:grid-cols-3 gap-6 mb-10">
            {plans.map((plan, index) => (
              <motion.div
                key={plan.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                whileHover={{ y: -2 }}
              >
                <Card className={`relative h-full bg-white border shadow-sm hover:shadow-md transition-shadow ${
                  plan.popular ? 'border-[#1dc962] ring-2 ring-[#1dc962]/20' : 'border-gray-100'
                }`}>
                  {plan.popular && (
                    <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 z-10">
                      <Badge className="bg-[#1dc962] text-white border-0 px-3 py-1">
                        <Star className="w-3 h-3 mr-1" />
                        Популярный
                      </Badge>
                    </div>
                  )}
                  
                  <CardHeader className="text-center pb-4 pt-6">
                    <div className="w-12 h-12 bg-gray-50 rounded-lg flex items-center justify-center mx-auto mb-4">
                      <Building className="w-6 h-6 text-[#1dc962]" />
                    </div>
                    
                    <CardTitle className="text-xl font-bold mb-2 text-gray-900">{plan.name}</CardTitle>
                    <CardDescription className="text-[#58625d]">{plan.description}</CardDescription>
                    
                    <div className="pt-4">
                      <div className="text-2xl font-bold text-gray-900">
                        {plan.price}
                      </div>
                    </div>
                  </CardHeader>
                  
                  <CardContent className="space-y-4 flex-1 p-6">
                    <Button 
                      className={`w-full ${plan.popular 
                        ? 'bg-[#1dc962] hover:bg-[#1dc962]/90 text-white' 
                        : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                      }`}
                      onClick={() => handleRequestAccess(plan.id)}
                    >
                      <Send className="w-4 h-4 mr-2" />
                      Получить доступ
                    </Button>
                    
                    <div className="space-y-5">
                      <h4 className="font-black text-slate-700 uppercase tracking-wide">
                        Что включено:
                      </h4>
                      {plan.features.map((feature, featureIndex) => (
                        <div key={featureIndex} className="flex items-start gap-3">
                          <Check className="w-6 h-6 text-emerald-600 flex-shrink-0 mt-0.5" />
                          <span className="text-slate-700 leading-relaxed font-medium">{feature}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>

          {/* Enhanced Contact Info */}
          <Card className="bg-gradient-to-r from-white/60 via-emerald-50/60 to-white/60 backdrop-blur-2xl border-white/60 shadow-2xl">
            <CardContent className="p-10 text-center">
              <h3 className="text-3xl font-black mb-4 text-slate-800">Нужна консультация?</h3>
              <p className="text-slate-600 mb-8 text-xl font-medium max-w-2xl mx-auto leading-relaxed">
                Наши эксперты помогут выбрать оптимальный тариф и ответят на все вопросы
              </p>
              <div className="flex flex-wrap justify-center gap-8">
                <div className="flex items-center gap-3 px-6 py-3 bg-white/60 backdrop-blur-xl rounded-full border border-white/60">
                  <Mail className="w-6 h-6 text-emerald-600" />
                  <span className="font-bold text-slate-700">support@esg-lite.ru</span>
                </div>
                <div className="flex items-center gap-3 px-6 py-3 bg-white/60 backdrop-blur-xl rounded-full border border-white/60">
                  <Phone className="w-6 h-6 text-emerald-600" />
                  <span className="font-bold text-slate-700">+7 (495) 123-45-67</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Enhanced Request Form Modal */}
      <AnimatePresence>
        {showRequestForm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-xl z-50 flex items-center justify-center p-4"
            onClick={() => setShowRequestForm(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              className="w-full max-w-2xl"
            >
              <Card className="border-white/40 shadow-3xl bg-white/90 backdrop-blur-2xl">
                <CardHeader className="border-b border-white/40 bg-gradient-to-r from-white/80 via-emerald-50/60 to-white/80 backdrop-blur-xl">
                  <CardTitle className="text-3xl font-black text-slate-800">Заявка на доступ</CardTitle>
                  <CardDescription className="text-xl font-medium text-slate-600">
                    Заполните форму для получения доступа к платформе ESG-Лайт
                  </CardDescription>
                </CardHeader>
                
                <CardContent className="p-8">
                  <form onSubmit={handleSubmitRequest} className="space-y-8">
                    <div className="grid md:grid-cols-2 gap-6">
                      <div>
                        <Label htmlFor="company" className="font-bold text-slate-700">Название компании *</Label>
                        <Input
                          id="company"
                          value={formData.company}
                          onChange={e => setFormData({...formData, company: e.target.value})}
                          placeholder='ООО "Пример"'
                          className="h-12 bg-white/80 backdrop-blur-xl border-white/60 hover:border-white/80 focus:border-emerald-300 text-slate-700 font-medium"
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor="name" className="font-bold text-slate-700">ФИО контактного лица *</Label>
                        <Input
                          id="name"
                          value={formData.name}
                          onChange={e => setFormData({...formData, name: e.target.value})}
                          placeholder="Иванов Иван Иванович"
                          className="h-12 bg-white/80 backdrop-blur-xl border-white/60 hover:border-white/80 focus:border-emerald-300 text-slate-700 font-medium"
                          required
                        />
                      </div>
                    </div>

                    <div className="grid md:grid-cols-2 gap-6">
                      <div>
                        <Label htmlFor="email" className="font-bold text-slate-700">Email *</Label>
                        <Input
                          id="email"
                          type="email"
                          value={formData.email}
                          onChange={e => setFormData({...formData, email: e.target.value})}
                          placeholder="example@company.ru"
                          className="h-12 bg-white/80 backdrop-blur-xl border-white/60 hover:border-white/80 focus:border-emerald-300 text-slate-700 font-medium"
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor="phone" className="font-bold text-slate-700">Телефон *</Label>
                        <Input
                          id="phone"
                          value={formData.phone}
                          onChange={e => setFormData({...formData, phone: e.target.value})}
                          placeholder="+7 (999) 123-45-67"
                          className="h-12 bg-white/80 backdrop-blur-xl border-white/60 hover:border-white/80 focus:border-emerald-300 text-slate-700 font-medium"
                          required
                        />
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="employees" className="font-bold text-slate-700">Количество сотрудников</Label>
                      <Select onValueChange={value => setFormData({...formData, employees: value})}>
                        <SelectTrigger className="h-12 bg-white/80 backdrop-blur-xl border-white/60 hover:border-white/80 font-medium">
                          <SelectValue placeholder="Выберите размер компании" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1-10">1-10 сотрудников</SelectItem>
                          <SelectItem value="11-50">11-50 сотрудников</SelectItem>
                          <SelectItem value="51-200">51-200 сотрудников</SelectItem>
                          <SelectItem value="201-1000">201-1000 сотрудников</SelectItem>
                          <SelectItem value="1000+">Более 1000 сотрудников</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label htmlFor="message" className="font-bold text-slate-700">Дополнительная информация</Label>
                      <Textarea
                        id="message"
                        value={formData.message}
                        onChange={e => setFormData({...formData, message: e.target.value})}
                        placeholder="Расскажите о специфике вашей деятельности, объемах отчетности..."
                        className="bg-white/80 backdrop-blur-xl border-white/60 hover:border-white/80 focus:border-emerald-300 text-slate-700 font-medium"
                        rows={4}
                      />
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t border-border/50">
                      <Button 
                        type="button" 
                        variant="outline" 
                        onClick={() => setShowRequestForm(false)}
                      >
                        Отмена
                      </Button>
                      <Button 
                        type="submit"
                        className="bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary/80"
                      >
                        <Send className="w-4 h-4 mr-2" />
                        Отправить заявку
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </Layout>
  );
}