'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '../../lib/auth-context'
import { useRouter } from 'next/navigation'
import DashboardLayout from '@/components/DashboardLayout'
import ResponsiveTable from '@/components/ResponsiveTable'
import { Search, Download } from 'lucide-react'
import { format } from 'date-fns'
import Loading from '@/components/Loading'
import { RepairHistory } from '@/types/repair'
import { api } from '../../lib/api'

export default function RepairsHistoryPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [repairsHistory, setRepairsHistory] = useState<RepairHistory[]>([])
  const [loadingHistory, setLoadingHistory] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')

  // 🔹 Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 10 // ilan rows per page

  useEffect(() => {
    if (!loading && !user) {
      router.push('/')
    }
  }, [user, loading, router])

  useEffect(() => {
    if (user) {
      fetchRepairsHistory()
    }
  }, [user])

  const fetchRepairsHistory = async () => {
    try {
      setLoadingHistory(true)
      const response = await api.get('/api/repairs-history')
      setRepairsHistory(response.data)
    } catch (error) {
      console.error('Error fetching repairs history:', error)
    } finally {
      setLoadingHistory(false)
    }
  }


  // 🔎 Unified Search - searches across all fields
  const filteredHistory = repairsHistory.filter(repair => {
    if (!searchTerm) return true
    
    const q = searchTerm.toLowerCase()
    return (
      (repair.company_name?.toLowerCase() || '').includes(q) ||
      (repair.device_model?.toLowerCase() || '').includes(q) ||
      (repair.serial_number?.toLowerCase() || '').includes(q) ||
      (repair.technician?.toLowerCase() || '').includes(q) ||
      (repair.action_taken?.toLowerCase() || '').includes(q) ||
      (repair.sq?.toLowerCase() || '').includes(q) ||
      (repair.description?.toLowerCase() || '').includes(q)
    )
  })

  // 🔹 Pagination logic
  const totalPages = Math.ceil(filteredHistory.length / pageSize)
  const paginatedHistory = filteredHistory.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  const parseTechnician = (repair: any) => {
    // Use the technician field from backend if available, otherwise parse from notes
    if (repair.technician) return repair.technician
    
    const notes = repair.technician_notes
    if (!notes) return ''
    const m = notes.match(/Completed by:\s*([^\.]+)\./i)
    return (m && m[1]?.trim()) || ''
  }

  const parseActionTaken = (repair: any) => {
    // Use the action_taken field from backend if available, otherwise parse from notes
    if (repair.action_taken) return repair.action_taken
    
    const notes = repair.technician_notes
    if (!notes) return ''
    const m = notes.match(/Action:\s*([^\.]+?)(?:\.|\s*Notes:|$)/i)
    return (m && m[1]?.trim()) || ''
  }

  const downloadCsv = (filename: string, rows: any[][]) => {
    // Add BOM for proper UTF-8 encoding in Excel
    const BOM = '\uFEFF'
    const csv = BOM + rows.map(row => 
      row.map(cell => {
        const cellStr = String(cell || '')
        // Escape quotes and wrap in quotes if contains comma, quote, or newline
        if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
          return `"${cellStr.replace(/"/g, '""')}"`
        }
        return cellStr
      }).join(',')
    ).join('\n')
    
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const exportRepairsHistory = () => {
    const header = ['SQ','Date Received','Date Completed','Company','Model','Serial','Part Number','RMA Case','Technician','Action Taken']
    const rows = [header, ...filteredHistory.map((repair, idx) => [
      idx + 1,
      repair.date_received ? format(new Date(repair.date_received), 'MM/dd/yyyy') : '',
      repair.repair_closed ? format(new Date(repair.repair_closed), 'MM/dd/yyyy') : '',
      repair.company_name || '',
      repair.device_model || '',
      repair.serial_number || '',
      repair.part_number || '',
      repair.rma_case || '',
      parseTechnician(repair),
      parseActionTaken(repair)
    ])]
    downloadCsv(`repairs_history_${new Date().toISOString().slice(0,10)}.csv`, rows)
  }

  if (loading || loadingHistory) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loading label="Loading repairs history..." />
      </div>
    )
  }

  if (!user) {
    return null
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Repairs History</h1>
            <p className="text-gray-600">Completed repairs and maintenance records</p>
          </div>
          <div className="mt-4 sm:mt-0">
            <button 
              className="inline-flex items-center px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium rounded-md shadow-sm transition-all duration-200 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2" 
              onClick={exportRepairsHistory}
            >
              <Download className="h-3 w-3 mr-1.5" />
              Export CSV
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="card">
          <div className="max-w-md">
            <label className="block text-sm font-medium text-gray-700 mb-2">Search Repairs</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search by company, model, technician, serial number, action taken..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value)
                  setCurrentPage(1)
                }}
                className="input pl-10 w-full"
              />
            </div>
            {searchTerm && (
              <p className="text-sm text-gray-500 mt-2">
                Found {filteredHistory.length} repair{filteredHistory.length !== 1 ? 's' : ''}
              </p>
            )}
          </div>
        </div>

        {/* Repairs History Table */}
        <ResponsiveTable
          minWidth={1600}
          emptyText="No completed repairs found"
          columns={[
            { title: 'SQ', dataIndex: 'sq', key: 'sq', render: (_v, record: any) => filteredHistory.indexOf(record) + 1 },
            { title: 'Date Received', dataIndex: 'date_received', key: 'date_received', render: (v) => v ? format(new Date(v), 'MMM dd, yyyy') : '—' },
            { title: 'Date Completed', dataIndex: 'repair_closed', key: 'repair_closed', render: (v) => v ? format(new Date(v), 'MMM dd, yyyy') : '—' },
            { title: 'Company', dataIndex: 'company_name', key: 'company_name' },
            { title: 'Model', dataIndex: 'device_model', key: 'device_model' },
            { title: 'Serial', dataIndex: 'serial_number', key: 'serial_number', className: 'font-mono text-sm' },
            { title: 'Part Number', dataIndex: 'part_number', key: 'part_number' },
            { title: 'RMA Case', dataIndex: 'rma_case', key: 'rma_case' },
            {
              title: 'Technician',
              dataIndex: 'technician',
              key: 'technician',
              render: (_v, record: any) => parseTechnician(record) || '—'
            },
            {
              title: 'Action Taken',
              dataIndex: 'action_taken',
              key: 'action_taken',
              render: (_v, record: any) => parseActionTaken(record) || '—'
            },
          ]}
          dataSource={paginatedHistory}
        />

        {/* Pagination Controls */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-700">
              Showing <span className="font-medium">{filteredHistory.length === 0 ? 0 : (currentPage - 1) * pageSize + 1}</span> to <span className="font-medium">{Math.min(currentPage * pageSize, filteredHistory.length)}</span> of <span className="font-medium">{filteredHistory.length}</span> completed repairs
            </div>
            <div className="flex items-center space-x-2">
              <button
                className="btn btn-secondary text-sm"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(p => p - 1)}
              >
                Previous
              </button>
              <div className="flex items-center space-x-1">
                {Array.from({ length: Math.min(5, totalPages || 1) }, (_, i) => {
                  const page = i + 1
                  return (
                    <button
                      key={page}
                      className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                        currentPage === page ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-gray-100'
                      }`}
                      onClick={() => setCurrentPage(page)}
                    >
                      {page}
                    </button>
                  )
                })}
              </div>
              <button
                className="btn btn-secondary text-sm"
                disabled={currentPage === totalPages || totalPages === 0}
                onClick={() => setCurrentPage(p => p + 1)}
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
