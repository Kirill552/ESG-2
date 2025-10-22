'use client';

/**
 * Страница системных настроек
 * Управление key-value настройками системы
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AdminPageWrapper from '../components/AdminPageWrapper';

interface Setting {
  id: string;
  key: string;
  value: any;
  description: string | null;
  category: string | null;
  createdAt: string;
  updatedAt: string;
}

export default function SettingsPage() {
  const router = useRouter();
  const [settings, setSettings] = useState<Setting[]>([]);
  const [grouped, setGrouped] = useState<Record<string, Setting[]>>({});
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [editModal, setEditModal] = useState<{
    open: boolean;
    setting: Setting | null;
    isNew: boolean;
  }>({ open: false, setting: null, isNew: false });
  const [formData, setFormData] = useState({
    key: '',
    value: '',
    description: '',
    category: 'general',
  });

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/settings');

      if (response.status === 401) {
        router.push('/admin/login');
        return;
      }

      if (!response.ok) throw new Error('Ошибка загрузки настроек');

      const data = await response.json();
      setSettings(data.settings);
      setGrouped(data.grouped);
    } catch (error) {
      console.error('Error loading settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (setting: Setting) => {
    setFormData({
      key: setting.key,
      value: JSON.stringify(setting.value, null, 2),
      description: setting.description || '',
      category: setting.category || 'general',
    });
    setEditModal({ open: true, setting, isNew: false });
  };

  const handleNew = () => {
    setFormData({
      key: '',
      value: '{}',
      description: '',
      category: 'general',
    });
    setEditModal({ open: true, setting: null, isNew: true });
  };

  const handleSave = async () => {
    try {
      let parsedValue: any;
      try {
        parsedValue = JSON.parse(formData.value);
      } catch {
        parsedValue = formData.value; // Если не JSON, сохраняем как строку
      }

      const response = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key: formData.key,
          value: parsedValue,
          description: formData.description,
          category: formData.category,
        }),
      });

      if (!response.ok) throw new Error('Ошибка при сохранении');

      await loadSettings();
      setEditModal({ open: false, setting: null, isNew: false });
    } catch (error) {
      console.error('Error saving setting:', error);
      alert('Ошибка при сохранении настройки');
    }
  };

  const handleDelete = async (key: string) => {
    if (!confirm('Вы уверены, что хотите удалить эту настройку?')) return;

    try {
      const response = await fetch(`/api/admin/settings/${encodeURIComponent(key)}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Ошибка при удалении');

      await loadSettings();
    } catch (error) {
      console.error('Error deleting setting:', error);
      alert('Ошибка при удалении настройки');
    }
  };

  const displayedSettings =
    selectedCategory === 'all'
      ? settings
      : grouped[selectedCategory] || [];

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500 mx-auto mb-4"></div>
          <p className="text-gray-400">Загрузка настроек...</p>
        </div>
      </div>
    );
  }

  return (
    <AdminPageWrapper
      title="Системные настройки"
      breadcrumbs={[{ label: 'Дашборд', href: '/admin/dashboard' }, { label: 'Настройки' }]}
      actions={
        <button
          onClick={handleNew}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg"
        >
          + Добавить настройку
        </button>
      }
    >
      <div className="space-y-6">
        {/* Фильтр по категориям */}
        <div className="mb-6 flex gap-2 flex-wrap">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`px-4 py-2 rounded-lg text-sm ${
              selectedCategory === 'all'
                ? 'bg-emerald-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            Все ({settings.length})
          </button>
          {Object.keys(grouped).map((category) => (
            <button
              key={category}
              onClick={() => setSelectedCategory(category)}
              className={`px-4 py-2 rounded-lg text-sm ${
                selectedCategory === category
                  ? 'bg-emerald-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              {category} ({grouped[category].length})
            </button>
          ))}
        </div>

        {/* Таблица настроек */}
        <div className="bg-gray-900/50 rounded-lg border border-gray-800 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-800/50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">
                  Ключ
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">
                  Значение
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">
                  Категория
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">
                  Описание
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase">
                  Действия
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {displayedSettings.map((setting) => (
                <tr key={setting.id} className="hover:bg-gray-800/30">
                  <td className="px-4 py-3">
                    <code className="text-sm text-emerald-400">{setting.key}</code>
                  </td>
                  <td className="px-4 py-3 max-w-md">
                    <code className="text-xs text-gray-300 block truncate">
                      {JSON.stringify(setting.value)}
                    </code>
                  </td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-1 text-xs rounded-md bg-gray-800 text-gray-300">
                      {setting.category || 'general'}
                    </span>
                  </td>
                  <td className="px-4 py-3 max-w-xs">
                    <p className="text-sm text-gray-400 truncate">
                      {setting.description || '—'}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex gap-2 justify-end">
                      <button
                        onClick={() => handleEdit(setting)}
                        className="px-3 py-1 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded"
                      >
                        Изменить
                      </button>
                      <button
                        onClick={() => handleDelete(setting.key)}
                        className="px-3 py-1 text-xs bg-red-600 hover:bg-red-700 text-white rounded"
                      >
                        Удалить
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {displayedSettings.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-400">Настройки не найдены</p>
          </div>
        )}

      {/* Модалка редактирования */}
      {editModal.open && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 overflow-y-auto">
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-6 max-w-2xl w-full mx-4">
            <h3 className="text-xl font-bold text-white mb-6">
              {editModal.isNew ? 'Новая настройка' : 'Редактирование настройки'}
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-2">Ключ</label>
                <input
                  type="text"
                  value={formData.key}
                  onChange={(e) => setFormData({ ...formData, key: e.target.value })}
                  disabled={!editModal.isNew}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white disabled:opacity-50"
                  placeholder="settings.feature.enabled"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-2">Категория</label>
                <input
                  type="text"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white"
                  placeholder="general"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-2">
                  Значение (JSON или строка)
                </label>
                <textarea
                  value={formData.value}
                  onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white font-mono text-sm"
                  rows={6}
                  placeholder='{"enabled": true, "limit": 100}'
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-2">Описание</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white"
                  rows={2}
                  placeholder="Описание назначения настройки..."
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={handleSave}
                className="flex-1 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg"
              >
                Сохранить
              </button>
              <button
                onClick={() => setEditModal({ open: false, setting: null, isNew: false })}
                className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg"
              >
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </AdminPageWrapper>
  );
}
