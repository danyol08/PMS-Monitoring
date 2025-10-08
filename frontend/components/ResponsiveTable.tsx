
'use client'

import React from 'react'

export interface TableColumn<T = any> {
  title: string
  dataIndex: keyof T | string
  key?: string
  render?: (value: any, record: T, index: number) => React.ReactNode
  className?: string
}

interface TableProps<T = any> {
  columns: TableColumn<T>[]
  dataSource: T[]
  emptyText?: string
  minWidth?: number
}

export default function ResponsiveTable<T = any>({ columns, dataSource, emptyText = 'No records found', minWidth = 1000 }: TableProps<T>) {
  return (
    <div className="bg-white shadow rounded-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className={`table min-w-[${minWidth}px]`}>
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200 text-left">
              {columns.map((col, idx) => (
                <th key={col.key || String(col.dataIndex) || idx}
                    className={`px-4 py-3 border-r border-gray-300 whitespace-nowrap ${col.className || ''}`}>{col.title}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {dataSource.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-center text-gray-500" colSpan={columns.length}>{emptyText}</td>
              </tr>
            ) : (
              dataSource.map((record: any, rowIdx: number) => (
                <tr key={record.id || rowIdx} className="odd:bg-white even:bg-gray-50 hover:bg-gray-50 align-middle">
                  {columns.map((col, colIdx) => {
                    const value = (record as any)[col.dataIndex as string]
                    return (
                      <td key={col.key || String(col.dataIndex) || colIdx} className={`px-4 py-3 border-r border-gray-200 ${col.className || ''}`}>
                        {col.render ? col.render(value, record, rowIdx) : value ?? '—'}
                      </td>
                    )
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

