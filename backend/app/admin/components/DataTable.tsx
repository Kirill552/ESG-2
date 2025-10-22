'use client';

/**
 * Универсальный компонент таблицы для админ-панели
 * Поддерживает: фильтрацию, сортировку, пагинацию, массовые действия
 */

import { useState } from 'react';

export interface Column<T> {
  key: string;
  label: string;
  sortable?: boolean;
  render?: (item: T) => React.ReactNode;
  width?: string;
}

export interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (item: T) => string | number;

  // Фильтрация
  searchable?: boolean;
  searchPlaceholder?: string;
  filters?: React.ReactNode;

  // Сортировка
  defaultSortKey?: string;
  defaultSortOrder?: 'asc' | 'desc';
  onSort?: (key: string, order: 'asc' | 'desc') => void;

  // Пагинация
  currentPage?: number;
  totalPages?: number;
  pageSize?: number;
  pageSizeOptions?: number[];
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (size: number) => void;

  // Массовые действия
  selectable?: boolean;
  selectedItems?: Set<string | number>;
  onSelectionChange?: (selected: Set<string | number>) => void;
  bulkActions?: React.ReactNode;

  // Состояния
  loading?: boolean;
  emptyMessage?: string;

  // Действия для строки
  rowActions?: (item: T) => React.ReactNode;
}

export default function DataTable<T>({
  columns,
  data,
  keyExtractor,
  searchable = false,
  searchPlaceholder = 'Поиск...',
  filters,
  defaultSortKey,
  defaultSortOrder = 'asc',
  onSort,
  currentPage = 1,
  totalPages = 1,
  pageSize = 25,
  pageSizeOptions = [10, 25, 50, 100],
  onPageChange,
  onPageSizeChange,
  selectable = false,
  selectedItems = new Set(),
  onSelectionChange,
  bulkActions,
  loading = false,
  emptyMessage = 'Нет данных для отображения',
  rowActions,
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | undefined>(defaultSortKey);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>(defaultSortOrder);
  const [searchQuery, setSearchQuery] = useState('');

  const handleSort = (key: string) => {
    const newOrder = sortKey === key && sortOrder === 'asc' ? 'desc' : 'asc';
    setSortKey(key);
    setSortOrder(newOrder);
    onSort?.(key, newOrder);
  };

  const handleSelectAll = () => {
    if (selectedItems.size === data.length) {
      onSelectionChange?.(new Set());
    } else {
      const allIds = new Set(data.map(keyExtractor));
      onSelectionChange?.(allIds);
    }
  };

  const handleSelectItem = (id: string | number) => {
    const newSelected = new Set(selectedItems);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    onSelectionChange?.(newSelected);
  };

  const isAllSelected = data.length > 0 && selectedItems.size === data.length;
  const isSomeSelected = selectedItems.size > 0 && selectedItems.size < data.length;

  return (
    <div className="space-y-4">
      {/* Поиск и фильтры */}
      {(searchable || filters) && (
        <div className="flex flex-col sm:flex-row gap-4">
          {searchable && (
            <div className="flex-1">
              <div className="relative">
                <svg
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
                <input
                  type="text"
                  placeholder={searchPlaceholder}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-gray-900 border border-gray-800 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500 transition-colors"
                />
              </div>
            </div>
          )}
          {filters && <div className="flex gap-2">{filters}</div>}
        </div>
      )}

      {/* Массовые действия */}
      {selectable && selectedItems.size > 0 && bulkActions && (
        <div className="flex items-center gap-4 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-4 py-3">
          <span className="text-sm text-emerald-400 font-medium">
            Выбрано: {selectedItems.size}
          </span>
          <div className="flex gap-2">{bulkActions}</div>
        </div>
      )}

      {/* Таблица */}
      <div className="bg-gray-900/50 border border-gray-800 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-900 border-b border-gray-800">
              <tr>
                {selectable && (
                  <th className="px-4 py-3 text-left w-12">
                    <input
                      type="checkbox"
                      checked={isAllSelected}
                      ref={(input) => {
                        if (input) input.indeterminate = isSomeSelected;
                      }}
                      onChange={handleSelectAll}
                      className="w-4 h-4 rounded border-gray-700 bg-gray-800 text-emerald-600 focus:ring-emerald-500 focus:ring-offset-0"
                    />
                  </th>
                )}
                {columns.map((column) => (
                  <th
                    key={column.key}
                    className={`px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider ${
                      column.width || ''
                    }`}
                  >
                    {column.sortable ? (
                      <button
                        onClick={() => handleSort(column.key)}
                        className="flex items-center gap-2 hover:text-gray-300 transition-colors"
                      >
                        {column.label}
                        {sortKey === column.key && (
                          <svg
                            className={`w-4 h-4 transition-transform ${
                              sortOrder === 'desc' ? 'rotate-180' : ''
                            }`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M5 15l7-7 7 7"
                            />
                          </svg>
                        )}
                      </button>
                    ) : (
                      column.label
                    )}
                  </th>
                ))}
                {rowActions && (
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider w-24">
                    Действия
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {loading ? (
                <tr>
                  <td colSpan={columns.length + (selectable ? 1 : 0) + (rowActions ? 1 : 0)}>
                    <div className="flex items-center justify-center py-12">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
                    </div>
                  </td>
                </tr>
              ) : data.length === 0 ? (
                <tr>
                  <td
                    colSpan={columns.length + (selectable ? 1 : 0) + (rowActions ? 1 : 0)}
                    className="px-4 py-12 text-center text-gray-400"
                  >
                    {emptyMessage}
                  </td>
                </tr>
              ) : (
                data.map((item) => {
                  const id = keyExtractor(item);
                  const isSelected = selectedItems.has(id);

                  return (
                    <tr
                      key={id}
                      className={`hover:bg-gray-800/50 transition-colors ${
                        isSelected ? 'bg-emerald-500/5' : ''
                      }`}
                    >
                      {selectable && (
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleSelectItem(id)}
                            className="w-4 h-4 rounded border-gray-700 bg-gray-800 text-emerald-600 focus:ring-emerald-500 focus:ring-offset-0"
                          />
                        </td>
                      )}
                      {columns.map((column) => (
                        <td key={column.key} className="px-4 py-3 text-sm text-gray-300">
                          {column.render
                            ? column.render(item)
                            : (item as any)[column.key]?.toString() || '—'}
                        </td>
                      ))}
                      {rowActions && (
                        <td className="px-4 py-3 text-right text-sm">
                          {rowActions(item)}
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Пагинация */}
      {totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-400">Показывать по:</span>
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange?.(Number(e.target.value))}
              className="px-3 py-1.5 bg-gray-900 border border-gray-800 rounded-lg text-white text-sm focus:outline-none focus:border-emerald-500"
            >
              {pageSizeOptions.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => onPageChange?.(currentPage - 1)}
              disabled={currentPage === 1}
              className="px-3 py-1.5 bg-gray-900 border border-gray-800 rounded-lg text-white text-sm hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>

            <span className="text-sm text-gray-400">
              Страница {currentPage} из {totalPages}
            </span>

            <button
              onClick={() => onPageChange?.(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="px-3 py-1.5 bg-gray-900 border border-gray-800 rounded-lg text-white text-sm hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
