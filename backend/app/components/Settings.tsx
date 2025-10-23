import React, { useState, useEffect } from 'react';
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
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from './ui/collapsible';
import { startRegistration } from '@simplewebauthn/browser';
import { toast } from 'sonner';
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
  Trash2,
  AlertCircle,
  CheckCircle,
  Plus,
  Loader2,
  ChevronDown
} from 'lucide-react';

type Page = 'dashboard' | 'analytics' | 'documents' | 'reports' | 'settings' | 'pricing';

interface SettingsProps {
  onNavigate: (page: Page) => void;
  onLogout: () => void;
}

export function Settings({ onNavigate, onLogout }: SettingsProps) {
  // Состояния для форм
  const [profileData, setProfileData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    position: ''
  });

  const [organizationData, setOrganizationData] = useState({
    name: '',
    inn: '',
    kpp: '',
    address: '',
    industry: 'manufacturing',
    // Дополнительные поля для 296-ФЗ
    ogrn: '',
    okpo: '',
    oktmo: '',
    okato: '',
    okved: '',
    fullName: '',
    legalAddress: '',
    directorName: '',
    directorPosition: '',
    // Контактные данные организации (требуются для 296-ФЗ)
    phone: '',
    emailForBilling: ''
  });

  const [isAdditionalFieldsOpen, setIsAdditionalFieldsOpen] = useState(false);

  const [innAutofillLoading, setInnAutofillLoading] = useState(false);

  const [contacts, setContacts] = useState<Array<{
    id: string;
    name: string;
    position: string;
    email: string;
    isPrimary: boolean;
  }>>([]);

  const [loading, setLoading] = useState({
    profile: false,
    organization: false,
    contacts: false,
    notifications: false
  });

  const [notifications, setNotifications] = useState({
    email: true,
    push: false,
    reports: true,
    deadlines: true,
    documents: false
  });

  const [notificationSettings, setNotificationSettings] = useState({
    deadlineDays: [30, 7, 1],
    quietHoursStart: null as number | null,
    quietHoursEnd: null as number | null,
    timezone: 'Europe/Moscow'
  });

  const [notificationsSaveSuccess, setNotificationsSaveSuccess] = useState(false);

  const [security, setSecurity] = useState({
    twoFactor: false,
    passkey: false,
    sessionTimeout: '30'
  });

  const [contactDialog, setContactDialog] = useState({
    isOpen: false,
    isLoading: false,
    error: null as string | null
  });

  // Загружаем текущее состояние Passkey
  React.useEffect(() => {
    const checkPasskeyStatus = async () => {
      try {
        const response = await fetch('/api/auth/passkey/status', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ email: 'whirpy@yandex.ru' }),
        });

        const result = await response.json();
        if (response.ok && result.ok && result.hasPasskey) {
          setSecurity(prev => ({ ...prev, passkey: true }));
        }
      } catch (error) {
        console.warn('Failed to check passkey status', error);
      }
    };

    checkPasskeyStatus();
  }, []);

  // Загружаем данные организации при монтировании
  useEffect(() => {
    const loadOrganizationData = async () => {
      setLoading(prev => ({ ...prev, organization: true }));
      try {
        const response = await fetch('/api/settings/organization');

        if (response.ok) {
          const result = await response.json();

          if (result.ok && result.organization) {
            const org = result.organization;
            setOrganizationData({
              name: org.name || '',
              inn: org.inn || '',
              kpp: org.kpp || '',
              address: org.address || '',
              industry: org.industry || 'manufacturing',
              ogrn: org.ogrn || '',
              okpo: org.okpo || '',
              oktmo: org.oktmo || '',
              okato: org.okato || '',
              okved: org.okved || '',
              fullName: org.fullName || '',
              legalAddress: org.legalAddress || org.address || '',
              directorName: org.directorName || '',
              directorPosition: org.directorPosition || '',
              phone: org.phone || '',
              emailForBilling: org.emailForBilling || ''
            });
          }
        }
      } catch (error) {
        console.error('Ошибка при загрузке данных организации:', error);
      } finally {
        setLoading(prev => ({ ...prev, organization: false }));
      }
    };

    loadOrganizationData();
  }, []);

  // Загружаем настройки уведомлений при монтировании
  useEffect(() => {
    const loadNotificationPreferences = async () => {
      setLoading(prev => ({ ...prev, notifications: true }));
      try {
        const response = await fetch('/api/settings/notifications');

        if (response.ok) {
          const data = await response.json();

          // Обновляем состояние каналов доставки и типов уведомлений
          setNotifications({
            email: data.emailEnabled,
            push: data.pushEnabled,
            reports: data.reportsEnabled,
            deadlines: data.deadlinesEnabled,
            documents: data.documentsEnabled
          });

          // Обновляем дополнительные настройки
          setNotificationSettings({
            deadlineDays: data.deadlineDays || [30, 7, 1],
            quietHoursStart: data.quietHoursStart,
            quietHoursEnd: data.quietHoursEnd,
            timezone: data.timezone || 'Europe/Moscow'
          });
        } else {
          console.error('Ошибка загрузки настроек уведомлений');
        }
      } catch (error) {
        console.error('Ошибка при загрузке настроек уведомлений:', error);
      } finally {
        setLoading(prev => ({ ...prev, notifications: false }));
      }
    };

    loadNotificationPreferences();
  }, []);

  const [passkeyDialog, setPasskeyDialog] = useState({
    isOpen: false,
    isLoading: false,
    error: null as string | null,
    success: false
  });

  const handlePasskeyToggle = async (checked: boolean) => {
    if (checked && !security.passkey) {
      // Включаем Passkey - показываем модальное окно для регистрации
      setPasskeyDialog({ isOpen: true, isLoading: false, error: null, success: false });
    } else if (!checked && security.passkey) {
      // Выключаем Passkey - удаляем все Passkey у пользователя
      try {
        const response = await fetch('/api/auth/passkey/remove', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ email: 'whirpy@yandex.ru' }),
        });

        if (response.ok) {
          setSecurity(prev => ({ ...prev, passkey: false }));
        } else {
          console.error('Failed to remove passkey');
        }
      } catch (error) {
        console.error('Error removing passkey', error);
      }
    }
  };

  // Автозаполнение реквизитов при вводе ИНН
  const handleInnChange = async (inn: string) => {
    setOrganizationData(prev => ({ ...prev, inn }));

    // Убираем пробелы и дефисы
    const cleanInn = inn.replace(/[\s-]/g, '');

    // Автозаполнение при вводе 10 (ЮЛ) или 12 (ИП) цифр
    if (cleanInn.length === 10 || cleanInn.length === 12) {
      setInnAutofillLoading(true);

      try {
        const response = await fetch('/api/organization/autofill', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ inn: cleanInn }),
        });

        if (response.ok) {
          const result = await response.json();

          if (result.success && result.data) {
            // Автозаполняем ВСЕ поля из Dadata/Checko API
            setOrganizationData(prev => ({
              ...prev,
              name: result.data.name || prev.name,
              kpp: result.data.kpp || prev.kpp,
              address: result.data.address || prev.address,
              // Дополнительные поля для 296-ФЗ
              ogrn: result.data.ogrn || prev.ogrn,
              okpo: result.data.okpo || prev.okpo,
              oktmo: result.data.oktmo || prev.oktmo,
              okato: result.data.okato || prev.okato,
              okved: result.data.okvedCode || result.data.okved || prev.okved,
              fullName: result.data.fullName || result.data.name || prev.fullName,
              legalAddress: result.data.address || prev.legalAddress,
              directorName: result.data.director || prev.directorName,
              directorPosition: result.data.directorPosition || prev.directorPosition,
            }));

            // Автоматически раскрываем секцию с дополнительными полями, если данные заполнены
            if (result.data.ogrn || result.data.okpo || result.data.director) {
              setIsAdditionalFieldsOpen(true);
            }

            console.log(`✅ Данные организации загружены из ${result.dataSource || 'API'}`);
          }
        } else {
          const error = await response.json();
          console.warn('⚠️ Не удалось загрузить данные организации:', error.error);
        }
      } catch (error) {
        console.error('❌ Ошибка при автозаполнении:', error);
      } finally {
        setInnAutofillLoading(false);
      }
    }
  };

  const setupPasskey = async () => {
    setPasskeyDialog(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      // Получаем опции для регистрации Passkey
      const response = await fetch('/api/auth/passkey/register/options', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: 'whirpy@yandex.ru' // В реальном приложении получать из сессии
        }),
      });

      const options = await response.json();

      if (!response.ok) {
        throw new Error(options.message || 'Не удалось получить опции для регистрации');
      }

      // Запускаем процесс регистрации Passkey
      const registration = await startRegistration(options.options);

      // Подтверждаем регистрацию на сервере
      const verifyResponse = await fetch('/api/auth/passkey/register/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: 'whirpy@yandex.ru',
          response: registration,
        }),
      });

      const verifyResult = await verifyResponse.json();

      if (!verifyResponse.ok) {
        throw new Error(verifyResult.message || 'Не удалось подтвердить регистрацию');
      }

      // Успешно настроили Passkey
      setSecurity(prev => ({ ...prev, passkey: true }));
      setPasskeyDialog({ isOpen: false, isLoading: false, error: null, success: true });

      // Показываем уведомление об успехе
      setTimeout(() => {
        setPasskeyDialog(prev => ({ ...prev, success: false }));
      }, 3000);

    } catch (error: any) {
      console.error('Ошибка настройки Passkey:', error);
      setPasskeyDialog(prev => ({
        ...prev,
        isLoading: false,
        error: error.message || 'Не удалось настроить Passkey'
      }));
    }
  };

  const closePasskeyDialog = () => {
    setPasskeyDialog({ isOpen: false, isLoading: false, error: null, success: false });
  };

  // Функция сохранения профиля
  const saveProfile = async () => {
    setLoading(prev => ({ ...prev, profile: true }));
    try {
      const response = await fetch('/api/settings/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(profileData),
      });

      const result = await response.json();

      if (response.ok && result.ok) {
        // Показать toast уведомление об успехе
        toast.success('Профиль успешно сохранен', {
          description: 'Ваши личные данные обновлены',
          duration: 3000,
        });

        // Создать уведомление в колокольчике
        await fetch('/api/notifications', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            type: 'profile_updated',
            title: 'Профиль обновлен',
            message: 'Ваши личные данные успешно сохранены',
          }),
        });
      } else {
        toast.error('Ошибка сохранения профиля', {
          description: result.message || 'Попробуйте еще раз',
        });
        console.error('Ошибка сохранения профиля:', result.message);
      }
    } catch (error) {
      toast.error('Ошибка при сохранении профиля', {
        description: 'Проверьте подключение к интернету',
      });
      console.error('Ошибка при сохранении профиля:', error);
    } finally {
      setLoading(prev => ({ ...prev, profile: false }));
    }
  };

  // Функция сохранения организации
  const saveOrganization = async () => {
    setLoading(prev => ({ ...prev, organization: true }));
    try {
      const response = await fetch('/api/settings/organization', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: organizationData.name,
          inn: organizationData.inn,
          kpp: organizationData.kpp,
          address: organizationData.address,
          industry: organizationData.industry,
          // Дополнительные поля для 296-ФЗ
          ogrn: organizationData.ogrn,
          okpo: organizationData.okpo,
          oktmo: organizationData.oktmo,
          okato: organizationData.okato,
          okvedCode: organizationData.okved,
          fullName: organizationData.fullName,
          legalAddress: organizationData.legalAddress,
          director: organizationData.directorName,
          directorPosition: organizationData.directorPosition,
          // Контактные данные организации (обязательные для 296-ФЗ)
          phone: organizationData.phone,
          emailForBilling: organizationData.emailForBilling
        }),
      });

      const result = await response.json();

      if (response.ok && result.ok) {
        // Показать toast уведомление об успехе
        toast.success('Данные организации успешно сохранены', {
          description: 'Информация о вашей организации обновлена',
          duration: 3000,
        });

        // Создать уведомление в колокольчике
        await fetch('/api/notifications', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            type: 'organization_updated',
            title: 'Организация обновлена',
            message: 'Данные вашей организации успешно сохранены',
          }),
        });

        console.log('Данные организации сохранены успешно');
      } else {
        toast.error('Ошибка сохранения организации', {
          description: result.message || 'Попробуйте еще раз',
        });
        console.error('Ошибка сохранения организации:', result.message);
      }
    } catch (error) {
      toast.error('Ошибка при сохранении организации', {
        description: 'Проверьте подключение к интернету',
      });
      console.error('Ошибка при сохранении организации:', error);
    } finally {
      setLoading(prev => ({ ...prev, organization: false }));
    }
  };

  // Функция сохранения настроек уведомлений
  const saveNotifications = async () => {
    setLoading(prev => ({ ...prev, notifications: true }));
    setNotificationsSaveSuccess(false);

    try {
      const response = await fetch('/api/settings/notifications', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          emailEnabled: notifications.email,
          pushEnabled: notifications.push,
          reportsEnabled: notifications.reports,
          deadlinesEnabled: notifications.deadlines,
          documentsEnabled: notifications.documents,
          deadlineDays: notificationSettings.deadlineDays,
          quietHoursStart: notificationSettings.quietHoursStart,
          quietHoursEnd: notificationSettings.quietHoursEnd,
          timezone: notificationSettings.timezone
        }),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        // Показываем уведомление об успехе
        setNotificationsSaveSuccess(true);

        // Скрываем уведомление через 3 секунды
        setTimeout(() => {
          setNotificationsSaveSuccess(false);
        }, 3000);
      } else {
        console.error('Ошибка сохранения настроек уведомлений:', result.error);
      }
    } catch (error) {
      console.error('Ошибка при сохранении настроек уведомлений:', error);
    } finally {
      setLoading(prev => ({ ...prev, notifications: false }));
    }
  };

  // Функция открытия диалога добавления контакта
  const openAddContactDialog = () => {
    setContactDialog({ isOpen: true, isLoading: false, error: null });
  };

  const closeContactDialog = () => {
    setContactDialog({ isOpen: false, isLoading: false, error: null });
  };

  // ========== ЭКСПОРТ, ИМПОРТ И УДАЛЕНИЕ ==========

  const [exportLoading, setExportLoading] = useState({
    reports: false,
    documents: false,
    profile: false,
    full: false,
  });

  const handleExportReports = async () => {
    setExportLoading(prev => ({ ...prev, reports: true }));
    try {
      const response = await fetch('/api/settings/data/export/reports');
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Ошибка экспорта отчётов');
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ESG_Reports_${new Date().toISOString().split('T')[0]}.zip`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Ошибка экспорта отчётов:', error);
      alert(error instanceof Error ? error.message : 'Ошибка экспорта отчётов');
    } finally {
      setExportLoading(prev => ({ ...prev, reports: false }));
    }
  };

  const handleExportDocuments = async () => {
    setExportLoading(prev => ({ ...prev, documents: true }));
    try {
      const response = await fetch('/api/settings/data/export/documents');
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Ошибка экспорта документов');
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ESG_Documents_${new Date().toISOString().split('T')[0]}.zip`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Ошибка экспорта документов:', error);
      alert(error instanceof Error ? error.message : 'Ошибка экспорта документов');
    } finally {
      setExportLoading(prev => ({ ...prev, documents: false }));
    }
  };

  const handleExportProfile = async () => {
    setExportLoading(prev => ({ ...prev, profile: true }));
    try {
      const response = await fetch('/api/settings/data/export/profile');
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Ошибка экспорта профиля');
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ESG_Profile_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Ошибка экспорта профиля:', error);
      alert(error instanceof Error ? error.message : 'Ошибка экспорта профиля');
    } finally {
      setExportLoading(prev => ({ ...prev, profile: false }));
    }
  };

  const handleExportFull = async () => {
    setExportLoading(prev => ({ ...prev, full: true }));
    try {
      const response = await fetch('/api/settings/data/export/full');
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Ошибка полного экспорта');
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ESG_Full_Export_${new Date().toISOString().split('T')[0]}.zip`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Ошибка полного экспорта:', error);
      alert(error instanceof Error ? error.message : 'Ошибка полного экспорта');
    } finally {
      setExportLoading(prev => ({ ...prev, full: false }));
    }
  };

  const handleImportExcel = async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.xlsx,.xls,.csv';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      try {
        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch('/api/settings/data/import/excel', {
          method: 'POST',
          body: formData,
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.message || 'Ошибка импорта');
        }

        alert(`Импорт завершён!\nУспешно: ${result.statistics.successCount}\nОшибок: ${result.statistics.errorCount}`);
      } catch (error) {
        console.error('Ошибка импорта:', error);
        alert(error instanceof Error ? error.message : 'Ошибка импорта данных');
      }
    };
    input.click();
  };

  const handleDeleteAllDocuments = async () => {
    const confirmation = prompt('Введите "УДАЛИТЬ ВСЕ ДОКУМЕНТЫ" для подтверждения:');
    if (confirmation !== 'УДАЛИТЬ ВСЕ ДОКУМЕНТЫ') {
      return;
    }

    try {
      const response = await fetch('/api/settings/data/documents', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmation }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || 'Ошибка удаления документов');
      }

      alert(`Документы удалены!\nВсего: ${result.statistics.totalDocuments}\nУдалено файлов: ${result.statistics.filesDeleted}`);
    } catch (error) {
      console.error('Ошибка удаления документов:', error);
      alert(error instanceof Error ? error.message : 'Ошибка удаления документов');
    }
  };

  const handleDeleteAccount = async () => {
    const confirmation = prompt('Введите "УДАЛИТЬ МОЙ АККАУНТ" для подтверждения:');
    if (confirmation !== 'УДАЛИТЬ МОЙ АККАУНТ') {
      return;
    }

    const email = prompt(`Введите ваш email (${profileData.email}) для подтверждения:`);
    if (email !== profileData.email) {
      alert('Email не совпадает');
      return;
    }

    try {
      const response = await fetch('/api/settings/data/account', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmation, email }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || 'Ошибка удаления аккаунта');
      }

      alert(`Аккаунт помечен на удаление.\nОкончательное удаление через ${result.daysUntilPermanentDeletion} дней.\n\nДля восстановления свяжитесь с поддержкой.`);

      // Выходим из системы
      setTimeout(() => onLogout(), 2000);
    } catch (error) {
      console.error('Ошибка удаления аккаунта:', error);
      alert(error instanceof Error ? error.message : 'Ошибка удаления аккаунта');
    }
  };

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
                        <Input
                          id="firstName"
                          value={profileData.firstName}
                          onChange={(e) => setProfileData(prev => ({ ...prev, firstName: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="lastName">Фамилия</Label>
                        <Input
                          id="lastName"
                          value={profileData.lastName}
                          onChange={(e) => setProfileData(prev => ({ ...prev, lastName: e.target.value }))}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        value={profileData.email}
                        onChange={(e) => setProfileData(prev => ({ ...prev, email: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone">Телефон</Label>
                      <Input
                        id="phone"
                        value={profileData.phone}
                        onChange={(e) => setProfileData(prev => ({ ...prev, phone: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="position">Должность</Label>
                      <Input
                        id="position"
                        value={profileData.position}
                        onChange={(e) => setProfileData(prev => ({ ...prev, position: e.target.value }))}
                      />
                    </div>
                    <Button
                      onClick={saveProfile}
                      disabled={loading.profile}
                      className="bg-[#1dc962] hover:bg-[#19b558] text-white"
                    >
                      {loading.profile ? (
                        <div className="flex items-center gap-2">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Сохранение...
                        </div>
                      ) : (
                        'Сохранить изменения'
                      )}
                    </Button>
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
                      <Input
                        id="companyName"
                        value={organizationData.name}
                        onChange={(e) => setOrganizationData(prev => ({ ...prev, name: e.target.value }))}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="inn">ИНН <span className="text-muted-foreground text-xs font-normal">(автозаполнение по ИНН)</span></Label>
                        <div className="relative">
                          <Input
                            id="inn"
                            value={organizationData.inn}
                            onChange={(e) => handleInnChange(e.target.value)}
                            disabled={innAutofillLoading}
                            placeholder="Введите ИНН для автозаполнения"
                          />
                          {innAutofillLoading && (
                            <div className="absolute right-3 top-1/2 -translate-y-1/2">
                              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="kpp">КПП</Label>
                        <Input
                          id="kpp"
                          value={organizationData.kpp}
                          onChange={(e) => setOrganizationData(prev => ({ ...prev, kpp: e.target.value }))}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="address">Юридический адрес</Label>
                      <Input
                        id="address"
                        value={organizationData.address}
                        onChange={(e) => setOrganizationData(prev => ({ ...prev, address: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="industry">Отрасль</Label>
                      <Select
                        value={organizationData.industry}
                        onValueChange={(value) => setOrganizationData(prev => ({ ...prev, industry: value }))}
                      >
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

                    <Separator />

                    {/* Дополнительные поля для отчетов 296-ФЗ */}
                    <Collapsible
                      open={isAdditionalFieldsOpen}
                      onOpenChange={setIsAdditionalFieldsOpen}
                      className="space-y-4"
                    >
                      <CollapsibleTrigger asChild>
                        <Button
                          variant="ghost"
                          className="w-full flex items-center justify-between p-0 h-auto hover:bg-transparent"
                        >
                          <div className="flex items-center gap-2">
                            <h4 className="text-sm font-medium text-gray-900">
                              Дополнительные данные для отчетов 296-ФЗ
                            </h4>
                            <Badge variant="outline" className="text-xs">
                              Опционально
                            </Badge>
                          </div>
                          <ChevronDown
                            className={`h-4 w-4 text-gray-500 transition-transform duration-200 ${
                              isAdditionalFieldsOpen ? 'transform rotate-180' : ''
                            }`}
                          />
                        </Button>
                      </CollapsibleTrigger>

                      <CollapsibleContent className="space-y-4">
                        <div className="pt-2 space-y-4">
                          {/* Обязательные поля */}
                          <div className="space-y-4">
                            <p className="text-sm text-muted-foreground">
                              Эти данные необходимы для корректного формирования отчета по 296-ФЗ
                            </p>

                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <Label htmlFor="ogrn">
                                  ОГРН <span className="text-red-500">*</span>
                                </Label>
                                <Input
                                  id="ogrn"
                                  value={organizationData.ogrn}
                                  onChange={(e) =>
                                    setOrganizationData(prev => ({ ...prev, ogrn: e.target.value }))
                                  }
                                  placeholder="1234567890123"
                                  maxLength={13}
                                />
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor="okved">
                                  ОКВЭД <span className="text-red-500">*</span>
                                </Label>
                                <Input
                                  id="okved"
                                  value={organizationData.okved}
                                  onChange={(e) =>
                                    setOrganizationData(prev => ({ ...prev, okved: e.target.value }))
                                  }
                                  placeholder="01.11"
                                />
                              </div>
                            </div>

                            <div className="space-y-2">
                              <Label htmlFor="fullName">
                                Полное наименование организации <span className="text-red-500">*</span>
                              </Label>
                              <Input
                                id="fullName"
                                value={organizationData.fullName}
                                onChange={(e) =>
                                  setOrganizationData(prev => ({ ...prev, fullName: e.target.value }))
                                }
                                placeholder="Общество с ограниченной ответственностью «ЭкоТех»"
                              />
                            </div>

                            <div className="space-y-2">
                              <Label htmlFor="legalAddress">
                                Юридический адрес (полный) <span className="text-red-500">*</span>
                              </Label>
                              <Input
                                id="legalAddress"
                                value={organizationData.legalAddress}
                                onChange={(e) =>
                                  setOrganizationData(prev => ({ ...prev, legalAddress: e.target.value }))
                                }
                                placeholder="123456, Российская Федерация, г. Москва, ул. Примерная, д. 1, офис 10"
                              />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <Label htmlFor="directorName">
                                  ФИО руководителя <span className="text-red-500">*</span>
                                </Label>
                                <Input
                                  id="directorName"
                                  value={organizationData.directorName}
                                  onChange={(e) =>
                                    setOrganizationData(prev => ({ ...prev, directorName: e.target.value }))
                                  }
                                  placeholder="Иванов Иван Иванович"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor="directorPosition">
                                  Должность руководителя <span className="text-red-500">*</span>
                                </Label>
                                <Input
                                  id="directorPosition"
                                  value={organizationData.directorPosition}
                                  onChange={(e) =>
                                    setOrganizationData(prev => ({ ...prev, directorPosition: e.target.value }))
                                  }
                                  placeholder="Генеральный директор"
                                />
                              </div>
                            </div>

                            {/* Контактные данные организации */}
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <Label htmlFor="orgPhone">
                                  Контактный телефон <span className="text-red-500">*</span>
                                </Label>
                                <Input
                                  id="orgPhone"
                                  value={organizationData.phone}
                                  onChange={(e) =>
                                    setOrganizationData(prev => ({ ...prev, phone: e.target.value }))
                                  }
                                  placeholder="+7 (495) 123-45-67"
                                  type="tel"
                                />
                                <p className="text-xs text-muted-foreground">
                                  Для связи с проверяющими органами
                                </p>
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor="orgEmail">
                                  Email для связи <span className="text-red-500">*</span>
                                </Label>
                                <Input
                                  id="orgEmail"
                                  value={organizationData.emailForBilling}
                                  onChange={(e) =>
                                    setOrganizationData(prev => ({ ...prev, emailForBilling: e.target.value }))
                                  }
                                  placeholder="info@company.ru"
                                  type="email"
                                />
                                <p className="text-xs text-muted-foreground">
                                  Для официальных уведомлений
                                </p>
                              </div>
                            </div>
                          </div>

                          <Separator />

                          {/* Опциональные поля */}
                          <div className="space-y-4">
                            <p className="text-sm text-muted-foreground">
                              Дополнительные коды (могут потребоваться для некоторых типов отчетов)
                            </p>

                            <div className="grid grid-cols-3 gap-4">
                              <div className="space-y-2">
                                <Label htmlFor="okpo">ОКПО</Label>
                                <Input
                                  id="okpo"
                                  value={organizationData.okpo}
                                  onChange={(e) =>
                                    setOrganizationData(prev => ({ ...prev, okpo: e.target.value }))
                                  }
                                  placeholder="12345678"
                                  maxLength={10}
                                />
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor="oktmo">ОКТМО</Label>
                                <Input
                                  id="oktmo"
                                  value={organizationData.oktmo}
                                  onChange={(e) =>
                                    setOrganizationData(prev => ({ ...prev, oktmo: e.target.value }))
                                  }
                                  placeholder="12345678"
                                  maxLength={11}
                                />
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor="okato">ОКАТО</Label>
                                <Input
                                  id="okato"
                                  value={organizationData.okato}
                                  onChange={(e) =>
                                    setOrganizationData(prev => ({ ...prev, okato: e.target.value }))
                                  }
                                  placeholder="12345678901"
                                  maxLength={11}
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      </CollapsibleContent>
                    </Collapsible>

                    <Button
                      onClick={saveOrganization}
                      disabled={loading.organization}
                      className="bg-[#1dc962] hover:bg-[#19b558] text-white"
                    >
                      {loading.organization ? (
                        <div className="flex items-center gap-2">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Сохранение...
                        </div>
                      ) : (
                        'Сохранить данные'
                      )}
                    </Button>
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
                      {contacts.map((contact) => (
                        <div key={contact.id} className="flex items-center justify-between p-4 border border-border/50 rounded-lg">
                          <div>
                            <div className="font-medium">{contact.name}</div>
                            <div className="text-sm text-muted-foreground">{contact.position}</div>
                            <div className="text-sm text-muted-foreground">{contact.email}</div>
                          </div>
                          {contact.isPrimary && <Badge variant="default">Основной</Badge>}
                        </div>
                      ))}
                      <Button
                        variant="outline"
                        className="w-full border-dashed border-2 border-gray-300 hover:border-[#1dc962] hover:bg-[#1dc962]/5 transition-colors"
                        onClick={openAddContactDialog}
                      >
                        <Plus className="w-4 h-4 mr-2" />
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
                  {notificationsSaveSuccess && (
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-green-50 border border-green-200">
                      <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                      <p className="text-sm text-green-700">Настройки уведомлений сохранены успешно!</p>
                    </div>
                  )}

                  {loading.notifications && (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-6 h-6 animate-spin text-[#1dc962]" />
                    </div>
                  )}

                  {!loading.notifications && (
                    <>
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

                      <Button
                        onClick={saveNotifications}
                        disabled={loading.notifications}
                        className="bg-[#1dc962] hover:bg-[#19b558] text-white"
                      >
                        {loading.notifications ? (
                          <div className="flex items-center gap-2">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Сохранение...
                          </div>
                        ) : (
                          'Сохранить настройки'
                        )}
                      </Button>
                    </>
                  )}
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
                        <Fingerprint className="w-4 h-4 text-gray-600" />
                        <div>
                          <Label>Пасскей</Label>
                          <p className="text-sm text-gray-600">
                            Быстрый вход без пароля
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={security.passkey}
                          onCheckedChange={handlePasskeyToggle}
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
                      <Button
                        variant="outline"
                        className="h-auto p-4 flex flex-col items-start"
                        onClick={handleExportReports}
                        disabled={exportLoading.reports}
                      >
                        <div className="flex items-center gap-2 mb-2">
                          {exportLoading.reports ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                          <span className="font-medium">Отчеты</span>
                        </div>
                        <span className="text-sm text-muted-foreground">
                          Все созданные отчеты в формате PDF
                        </span>
                      </Button>
                      <Button
                        variant="outline"
                        className="h-auto p-4 flex flex-col items-start"
                        onClick={handleExportDocuments}
                        disabled={exportLoading.documents}
                      >
                        <div className="flex items-center gap-2 mb-2">
                          {exportLoading.documents ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                          <span className="font-medium">Документы</span>
                        </div>
                        <span className="text-sm text-muted-foreground">
                          Архив загруженных файлов
                        </span>
                      </Button>
                      <Button
                        variant="outline"
                        className="h-auto p-4 flex flex-col items-start"
                        onClick={handleExportProfile}
                        disabled={exportLoading.profile}
                      >
                        <div className="flex items-center gap-2 mb-2">
                          {exportLoading.profile ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                          <span className="font-medium">Данные профиля</span>
                        </div>
                        <span className="text-sm text-muted-foreground">
                          Информация аккаунта в JSON
                        </span>
                      </Button>
                      <Button
                        variant="outline"
                        className="h-auto p-4 flex flex-col items-start"
                        onClick={handleExportFull}
                        disabled={exportLoading.full}
                      >
                        <div className="flex items-center gap-2 mb-2">
                          {exportLoading.full ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
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
                      <Button variant="outline" className="w-full justify-start" onClick={handleImportExcel}>
                        <Upload className="w-4 h-4 mr-2" />
                        Импорт из Excel/CSV
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
                      <Button
                        variant="outline"
                        className="text-destructive border-destructive hover:bg-destructive hover:text-destructive-foreground"
                        onClick={handleDeleteAllDocuments}
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Удалить все документы
                      </Button>
                      <Button variant="destructive" onClick={handleDeleteAccount}>
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

      {/* Passkey Setup Dialog */}
      <Dialog open={passkeyDialog.isOpen} onOpenChange={closePasskeyDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Fingerprint className="w-5 h-5 text-[#1dc962]" />
              Настройка Passkey
            </DialogTitle>
            <DialogDescription>
              Настройте безопасный вход без пароля с помощью биометрии или PIN-кода
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {passkeyDialog.error && (
              <div className="flex items-center gap-3 p-3 rounded-lg bg-red-50 border border-red-200">
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
                <p className="text-sm text-red-700">{passkeyDialog.error}</p>
              </div>
            )}

            {passkeyDialog.success && (
              <div className="flex items-center gap-3 p-3 rounded-lg bg-green-50 border border-green-200">
                <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                <p className="text-sm text-green-700">Passkey успешно настроен!</p>
              </div>
            )}

            <div className="space-y-3">
              <h4 className="font-medium text-gray-900">Что такое Passkey?</h4>
              <ul className="space-y-2 text-sm text-gray-600">
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                  Безопасный вход с помощью Face ID, Touch ID или Windows Hello
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                  Нет необходимости запоминать пароли
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                  Защита от фишинга и взлома
                </li>
              </ul>
            </div>
          </div>

          <DialogFooter className="flex gap-2">
            <Button
              variant="outline"
              onClick={closePasskeyDialog}
              disabled={passkeyDialog.isLoading}
            >
              Отмена
            </Button>
            <Button
              onClick={setupPasskey}
              disabled={passkeyDialog.isLoading || passkeyDialog.success}
              className="bg-[#1dc962] hover:bg-[#19b558]"
            >
              {passkeyDialog.isLoading ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Настройка...
                </div>
              ) : passkeyDialog.success ? (
                'Готово'
              ) : (
                'Настроить Passkey'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Contact Dialog */}
      <Dialog open={contactDialog.isOpen} onOpenChange={closeContactDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="w-5 h-5 text-[#1dc962]" />
              Добавить контактное лицо
            </DialogTitle>
            <DialogDescription>
              Добавьте нового ответственного за отчетность по выбросам
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {contactDialog.error && (
              <div className="flex items-center gap-3 p-3 rounded-lg bg-red-50 border border-red-200">
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
                <p className="text-sm text-red-700">{contactDialog.error}</p>
              </div>
            )}

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="contactName">Полное имя</Label>
                <Input
                  id="contactName"
                  placeholder="Иван Иванович Иванов"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contactEmail">Email</Label>
                <Input
                  id="contactEmail"
                  type="email"
                  placeholder="ivan.ivanov@company.ru"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contactPhone">Телефон</Label>
                <Input
                  id="contactPhone"
                  placeholder="+7 (999) 123-45-67"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contactPosition">Должность</Label>
                <Input
                  id="contactPosition"
                  placeholder="Специалист по экологии"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contactRole">Роль</Label>
                <Select defaultValue="OTHER">
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MAIN">Руководитель</SelectItem>
                    <SelectItem value="ACCOUNTANT">Бухгалтер</SelectItem>
                    <SelectItem value="ECOLOGIST">Эколог</SelectItem>
                    <SelectItem value="MANAGER">Менеджер</SelectItem>
                    <SelectItem value="OTHER">Другое</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <DialogFooter className="flex gap-2">
            <Button
              variant="outline"
              onClick={closeContactDialog}
              disabled={contactDialog.isLoading}
            >
              Отмена
            </Button>
            <Button
              onClick={() => {
                // TODO: Реализовать добавление контакта
                console.log('Добавление контакта...');
                closeContactDialog();
              }}
              disabled={contactDialog.isLoading}
              className="bg-[#1dc962] hover:bg-[#19b558]"
            >
              {contactDialog.isLoading ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Добавление...
                </div>
              ) : (
                'Добавить контакт'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}