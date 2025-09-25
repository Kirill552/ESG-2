import React, { useState } from 'react';
import { Layout } from './Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Switch } from './ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Badge } from './ui/badge';
import { Separator } from './ui/separator';
import { 
  User, 
  Building, 
  Bell, 
  Shield, 
  Key, 
  Mail, 
  Globe, 
  Smartphone,
  Fingerprint,
  Download,
  Upload,
  Trash2
} from 'lucide-react';

type Page = 'dashboard' | 'analytics' | 'documents' | 'reports' | 'settings' | 'pricing';

interface SettingsProps {
  onNavigate: (page: Page) => void;
  onLogout: () => void;
}

export function Settings({ onNavigate, onLogout }: SettingsProps) {
  const [notifications, setNotifications] = useState({
    email: true,
    push: false,
    reports: true,
    deadlines: true,
    documents: false
  });

  const [security, setSecurity] = useState({
    twoFactor: false,
    passkey: true,
    sessionTimeout: '30'
  });

  return (
    <Layout currentPage="settings" onNavigate={onNavigate} onLogout={onLogout}>
      <div className="flex-1 overflow-auto bg-[#fcfdfc]">
        <div className="p-6">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-12 bg-gray-50 rounded-xl flex items-center justify-center border border-gray-100">
              <User className="w-6 h-6 text-[#1dc962]" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Настройки</h1>
              <p className="text-[#58625d]">
                Управление аккаунтом и предпочтениями
              </p>
            </div>
          </div>

          <Tabs defaultValue="profile" className="space-y-6">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="profile">Профиль</TabsTrigger>
              <TabsTrigger value="organization">Организация</TabsTrigger>
              <TabsTrigger value="notifications">Уведомления</TabsTrigger>
              <TabsTrigger value="security">Безопасность</TabsTrigger>
              <TabsTrigger value="data">Данные</TabsTrigger>
            </TabsList>

            {/* Profile Tab */}
            <TabsContent value="profile">
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <User className="w-5 h-5" />
                      Личная информация
                    </CardTitle>
                    <CardDescription>
                      Обновите свою личную информацию и контактные данные
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="firstName">Имя</Label>
                        <Input id="firstName" defaultValue="Иван" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="lastName">Фамилия</Label>
                        <Input id="lastName" defaultValue="Петров" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <Input id="email" type="email" defaultValue="ivan.petrov@company.ru" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone">Телефон</Label>
                      <Input id="phone" defaultValue="+7 (999) 123-45-67" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="position">Должность</Label>
                      <Input id="position" defaultValue="Эколог" />
                    </div>
                    <Button>Сохранить изменения</Button>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Настройки интерфейса</CardTitle>
                    <CardDescription>
                      Персонализируйте внешний вид приложения
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label>Язык интерфейса</Label>
                        <p className="text-sm text-muted-foreground">Выберите предпочитаемый язык</p>
                      </div>
                      <Select defaultValue="ru">
                        <SelectTrigger className="w-40">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ru">Русский</SelectItem>
                          <SelectItem value="en">English</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <Label>Часовой пояс</Label>
                        <p className="text-sm text-muted-foreground">Используется для отчетов и уведомлений</p>
                      </div>
                      <Select defaultValue="msk">
                        <SelectTrigger className="w-60">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="msk">GMT+3 (Москва)</SelectItem>
                          <SelectItem value="spb">GMT+3 (Санкт-Петербург)</SelectItem>
                          <SelectItem value="ekb">GMT+5 (Екатеринбург)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Organization Tab */}
            <TabsContent value="organization">
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Building className="w-5 h-5" />
                      Информация об организации
                    </CardTitle>
                    <CardDescription>
                      Данные вашей организации для отчетности
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="companyName">Название организации</Label>
                      <Input id="companyName" defaultValue="ООО «ЭкоТех»" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="inn">ИНН</Label>
                        <Input id="inn" defaultValue="7700123456" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="kpp">КПП</Label>
                        <Input id="kpp" defaultValue="770001001" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="address">Юридический адрес</Label>
                      <Input id="address" defaultValue="123456, г. Москва, ул. Примерная, д. 1" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="industry">Отрасль</Label>
                      <Select defaultValue="manufacturing">
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="manufacturing">Производство</SelectItem>
                          <SelectItem value="energy">Энергетика</SelectItem>
                          <SelectItem value="transport">Транспорт</SelectItem>
                          <SelectItem value="retail">Торговля</SelectItem>
                          <SelectItem value="other">Другое</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Button>Сохранить данные</Button>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Контактные лица</CardTitle>
                    <CardDescription>
                      Ответственные за отчетность по выбросам
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between p-4 border border-border/50 rounded-lg">
                        <div>
                          <div className="font-medium">Иван Петров</div>
                          <div className="text-sm text-muted-foreground">Главный эколог</div>
                          <div className="text-sm text-muted-foreground">ivan.petrov@company.ru</div>
                        </div>
                        <Badge variant="default">Основной</Badge>
                      </div>
                      <Button variant="outline" className="w-full">
                        Добавить контактное лицо
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Notifications Tab */}
            <TabsContent value="notifications">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Bell className="w-5 h-5" />
                    Уведомления
                  </CardTitle>
                  <CardDescription>
                    Настройте, как и когда получать уведомления
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div>
                    <h4 className="font-medium mb-4">Способы доставки</h4>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Mail className="w-4 h-4 text-muted-foreground" />
                          <div>
                            <Label>Email уведомления</Label>
                            <p className="text-sm text-muted-foreground">
                              Получать уведомления на email
                            </p>
                          </div>
                        </div>
                        <Switch 
                          checked={notifications.email}
                          onCheckedChange={(checked) => 
                            setNotifications(prev => ({ ...prev, email: checked }))
                          }
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Smartphone className="w-4 h-4 text-muted-foreground" />
                          <div>
                            <Label>Push уведомления</Label>
                            <p className="text-sm text-muted-foreground">
                              Уведомления в браузере
                            </p>
                          </div>
                        </div>
                        <Switch 
                          checked={notifications.push}
                          onCheckedChange={(checked) => 
                            setNotifications(prev => ({ ...prev, push: checked }))
                          }
                        />
                      </div>
                    </div>
                  </div>

                  <Separator />

                  <div>
                    <h4 className="font-medium mb-4">Типы уведомлений</h4>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <Label>Готовность отчетов</Label>
                          <p className="text-sm text-muted-foreground">
                            Когда отчет готов к отправке
                          </p>
                        </div>
                        <Switch 
                          checked={notifications.reports}
                          onCheckedChange={(checked) => 
                            setNotifications(prev => ({ ...prev, reports: checked }))
                          }
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <div>
                          <Label>Приближение дедлайнов</Label>
                          <p className="text-sm text-muted-foreground">
                            За 30, 7 и 1 день до срока сдачи
                          </p>
                        </div>
                        <Switch 
                          checked={notifications.deadlines}
                          onCheckedChange={(checked) => 
                            setNotifications(prev => ({ ...prev, deadlines: checked }))
                          }
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <div>
                          <Label>Обработка документов</Label>
                          <p className="text-sm text-muted-foreground">
                            Результаты обработки загруженных файлов
                          </p>
                        </div>
                        <Switch 
                          checked={notifications.documents}
                          onCheckedChange={(checked) => 
                            setNotifications(prev => ({ ...prev, documents: checked }))
                          }
                        />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Security Tab */}
            <TabsContent value="security">
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Shield className="w-5 h-5" />
                      Безопасность аккаунта
                    </CardTitle>
                    <CardDescription>
                      Настройки безопасности и методы входа
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Key className="w-4 h-4 text-muted-foreground" />
                        <div>
                          <Label>Двухфакторная аутентификация</Label>
                          <p className="text-sm text-muted-foreground">
                            Дополнительная защита аккаунта
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch 
                          checked={security.twoFactor}
                          onCheckedChange={(checked) => 
                            setSecurity(prev => ({ ...prev, twoFactor: checked }))
                          }
                        />
                        {security.twoFactor && <Badge variant="default">Включено</Badge>}
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Fingerprint className="w-4 h-4 text-muted-foreground" />
                        <div>
                          <Label>Пасскей</Label>
                          <p className="text-sm text-muted-foreground">
                            Быстрый вход без пароля
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch 
                          checked={security.passkey}
                          onCheckedChange={(checked) => 
                            setSecurity(prev => ({ ...prev, passkey: checked }))
                          }
                        />
                        {security.passkey && <Badge variant="default">Настроен</Badge>}
                      </div>
                    </div>

                    <Separator />

                    <div className="flex items-center justify-between">
                      <div>
                        <Label>Время сеанса</Label>
                        <p className="text-sm text-muted-foreground">
                          Автоматический выход через
                        </p>
                      </div>
                      <Select 
                        value={security.sessionTimeout}
                        onValueChange={(value) => 
                          setSecurity(prev => ({ ...prev, sessionTimeout: value }))
                        }
                      >
                        <SelectTrigger className="w-40">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="15">15 минут</SelectItem>
                          <SelectItem value="30">30 минут</SelectItem>
                          <SelectItem value="60">1 час</SelectItem>
                          <SelectItem value="480">8 часов</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Активные сессии</CardTitle>
                    <CardDescription>
                      Устройства, с которых выполнен вход в аккаунт
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between p-4 border border-border/50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <Globe className="w-5 h-5 text-muted-foreground" />
                          <div>
                            <div className="font-medium">Chrome на Windows</div>
                            <div className="text-sm text-muted-foreground">
                              Москва, Россия • Текущая сессия
                            </div>
                          </div>
                        </div>
                        <Badge variant="default">Активна</Badge>
                      </div>
                      <div className="flex items-center justify-between p-4 border border-border/50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <Smartphone className="w-5 h-5 text-muted-foreground" />
                          <div>
                            <div className="font-medium">Safari на iPhone</div>
                            <div className="text-sm text-muted-foreground">
                              Москва, Россия • 2 дня назад
                            </div>
                          </div>
                        </div>
                        <Button variant="outline" size="sm">Завершить</Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Data Tab */}
            <TabsContent value="data">
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Экспорт данных</CardTitle>
                    <CardDescription>
                      Скачайте копию ваших данных
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <Button variant="outline" className="h-auto p-4 flex flex-col items-start">
                        <div className="flex items-center gap-2 mb-2">
                          <Download className="w-4 h-4" />
                          <span className="font-medium">Отчеты</span>
                        </div>
                        <span className="text-sm text-muted-foreground">
                          Все созданные отчеты в формате PDF
                        </span>
                      </Button>
                      <Button variant="outline" className="h-auto p-4 flex flex-col items-start">
                        <div className="flex items-center gap-2 mb-2">
                          <Download className="w-4 h-4" />
                          <span className="font-medium">Документы</span>
                        </div>
                        <span className="text-sm text-muted-foreground">
                          Архив загруженных файлов
                        </span>
                      </Button>
                      <Button variant="outline" className="h-auto p-4 flex flex-col items-start">
                        <div className="flex items-center gap-2 mb-2">
                          <Download className="w-4 h-4" />
                          <span className="font-medium">Данные профиля</span>
                        </div>
                        <span className="text-sm text-muted-foreground">
                          Информация аккаунта в JSON
                        </span>
                      </Button>
                      <Button variant="outline" className="h-auto p-4 flex flex-col items-start">
                        <div className="flex items-center gap-2 mb-2">
                          <Download className="w-4 h-4" />
                          <span className="font-medium">Полный экспорт</span>
                        </div>
                        <span className="text-sm text-muted-foreground">
                          Все данные одним архивом
                        </span>
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Импорт данных</CardTitle>
                    <CardDescription>
                      Загрузите данные из других систем
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <Button variant="outline" className="w-full justify-start">
                        <Upload className="w-4 h-4 mr-2" />
                        Импорт из Excel/CSV
                      </Button>
                      <Button variant="outline" className="w-full justify-start">
                        <Upload className="w-4 h-4 mr-2" />
                        Миграция из другой системы
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-destructive/50">
                  <CardHeader>
                    <CardTitle className="text-destructive">Опасная зона</CardTitle>
                    <CardDescription>
                      Необратимые действия с данными аккаунта
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <Button variant="outline" className="text-destructive border-destructive hover:bg-destructive hover:text-destructive-foreground">
                        <Trash2 className="w-4 h-4 mr-2" />
                        Удалить все документы
                      </Button>
                      <Button variant="destructive">
                        <Trash2 className="w-4 h-4 mr-2" />
                        Удалить аккаунт
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </Layout>
  );
}