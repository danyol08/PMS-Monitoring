'use client'
import AddContractModal from '@/components/AddContractModal'
import ImportModal from '@/components/ImportModal'
import { useAuth } from '@/lib/auth-context'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import DashboardLayout from '@/components/DashboardLayout'
import { api } from '@/lib/api'
import { supabase } from '@/lib/supabase'
import { format } from 'date-fns'
import { Plus, Search, Filter, Download, Edit, Trash2, Eye, MoreHorizontal, Upload } from 'lucide-react'
import ResponsiveTable, { TableColumn } from '@/components/ResponsiveTable'
import Loading from '@/components/Loading'

interface HardwareContract {
  id: string;
  sq: string;
  end_user: string;
  model: string;
  serial: string;
  next_pms_schedule: string;
  branch: string;
  technical_specialist: string;
  date_of_contract?: string;
  end_of_contract?: string;
  status?: string;
  po_number?: string;
  service_report?: string;
  history?: string;
  frequency?: string;
  reports?: string;
  documentation?: string;
  created_at: string;
  updated_at: string;
}

export default function HardwareContracts() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [contracts, setContracts] = useState<HardwareContract[]>([])
  const [loadingContracts, setLoadingContracts] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingContract, setEditingContract] = useState<HardwareContract | null>(null)
  const [isImportModalOpen, setIsImportModalOpen] = useState(false)

  // 🟢 Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const rowsPerPage = 10

  useEffect(() => {
    if (!loading && !user) {
      router.push('/')
    }
  }, [user, loading, router])

  useEffect(() => {
    if (user) {
      fetchContracts()
    }
  }, [user])

  const fetchContracts = async () => {
    try {
      console.log('Fetching hardware contracts...')
      const response = await api.get('/api/contracts/hardware')
      console.log('Hardware contracts response:', response.data)
      setContracts(response.data || [])
    } catch (error) {
      console.error('Error fetching contracts:', error)
      try {
        const { data, error: supabaseError } = await supabase
          .from('hardware_contracts')
          .select('*')
          .order('created_at', { ascending: false })

        if (supabaseError) {
          console.error('Supabase error:', supabaseError)
        } else {
          console.log('Supabase data:', data)
          setContracts(data || [])
        }
      } catch (supabaseErr) {
        console.error('Supabase fetch error:', supabaseErr)
      }
    } finally {
      setLoadingContracts(false)
    }
  }

  // 🔎 Search filter
  const filteredContracts = contracts.filter(contract => {
    const q = searchTerm.toLowerCase()
    return (
      contract.sq.toLowerCase().includes(q) ||
      contract.end_user.toLowerCase().includes(q) ||
      contract.model.toLowerCase().includes(q) ||
      contract.serial.toLowerCase().includes(q)
    )
  })

  // 🟢 Paginate filtered results
  const startIndex = (currentPage - 1) * rowsPerPage
  const endIndex = startIndex + rowsPerPage
  const paginatedContracts = filteredContracts.slice(startIndex, endIndex)
  const totalPages = Math.ceil(filteredContracts.length / rowsPerPage)

  if (loading || loadingContracts) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loading label="Loading hardware contracts..." />
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
            <h1 className="text-3xl font-bold text-gray-900">Hardware Contracts</h1>
            <p className="text-gray-600 mt-1">Manage your hardware maintenance contracts and schedules</p>
          </div>
          <div className="mt-4 sm:mt-0 flex items-center space-x-3">
            {(user?.role === 'admin' || user?.role === 'technician') && (
              <>
                {/* <button
                  onClick={() => setIsImportModalOpen(true)}
                  className="group relative inline-flex items-center justify-center px-6 py-3 text-sm font-semibold text-white bg-gradient-to-r from-green-600 to-emerald-600 border border-transparent rounded-xl hover:from-green-700 hover:to-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-green-600 to-emerald-600 rounded-xl opacity-0 group-hover:opacity-20 transition-opacity duration-200"></div>
                  <Upload className="h-5 w-5 mr-2 group-hover:rotate-12 transition-transform duration-200" />
                  <span className="relative z-10">Import Excel</span>
                </button> */}
                <button
                  className="inline-flex items-center px-6 py-3 text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-indigo-600 border border-transparent rounded-lg hover:from-blue-700 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 shadow-sm hover:shadow-md transition-all duration-200"
                  onClick={() => { setEditingContract(null); setIsModalOpen(true) }}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Contract
                </button>
              </>
            )}
          </div>
        </div>
        <AddContractModal
          isOpen={isModalOpen}
          onClose={() => { setIsModalOpen(false); setEditingContract(null) }}
          onSuccess={() => { setEditingContract(null); fetchContracts() }}
          contract={editingContract}
        />
        
        <ImportModal
          isOpen={isImportModalOpen}
          onClose={() => setIsImportModalOpen(false)}
          onSuccess={() => { fetchContracts(); setCurrentPage(1) }}
          importType="hardware"
          title="Hardware Contracts"
        />


        {/* Search and Filters */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-2">Search Contracts</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by company, model, serial, or specialist..."
                  value={searchTerm}
                  onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1) }}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                />
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <div className="text-sm text-gray-500">
                {filteredContracts.length} of {contracts.length} contracts
              </div>
            </div>
          </div>
        </div>

        {/* Contracts Table */}
        <ResponsiveTable<HardwareContract>
          minWidth={1800}
          emptyText="No contracts found"
          columns={([
            { title: 'SQ', dataIndex: 'sq', key: 'sq', className: 'text-center', render: (_v: any, record: HardwareContract) => filteredContracts.indexOf(record) + 1 },
            { title: 'End User', dataIndex: 'end_user', key: 'end_user' },
            { title: 'Part Number', dataIndex: 'model', key: 'model' },
            { title: 'Serial', dataIndex: 'serial', key: 'serial', className: 'font-mono text-sm' },
            { title: 'Next PMS Schedule', dataIndex: 'next_pms_schedule', key: 'next_pms_schedule', render: (v) => v ? format(new Date(v), 'dd-MMM-yy') : '—' },
            { title: 'Branch', dataIndex: 'branch', key: 'branch' },
            { title: 'Sales', dataIndex: 'technical_specialist', key: 'technical_specialist' },
            { title: 'Date of Contract', dataIndex: 'date_of_contract', key: 'date_of_contract', render: (v) => v ? format(new Date(v), 'dd-MMM-yy') : '—' },
            { title: 'End of Contract', dataIndex: 'end_of_contract', key: 'end_of_contract', render: (v) => v ? format(new Date(v), 'dd-MMM-yy') : '—' },
            { title: 'Status', dataIndex: 'status', key: 'status' },
            { title: 'PO Number', dataIndex: 'po_number', key: 'po_number' },
            { title: 'Service Report', dataIndex: 'service_report', key: 'service_report' },
            { title: 'History', dataIndex: 'history', key: 'history' },
            { title: 'Frequency', dataIndex: 'frequency', key: 'frequency' },
            { 
              title: 'Documentation', 
              dataIndex: 'documentation', 
              key: 'documentation',
              render: (value: string | undefined) => {
                const doc = (value || '').trim()
                const isUrl = /^https?:\/\//i.test(doc)
                return doc
                  ? (
                    isUrl 
                      ? <a href={doc} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline break-all">{doc}</a>
                      : <span className="break-all">{doc}</span>
                  )
                  : '—'
              }
            },
            {
              title: 'Actions', key: 'actions', render: (_v: any, record: HardwareContract) => (
              <div className="flex items-center gap-2">
                {(user?.role === 'admin' || user?.role === 'technician') && (
                  <button 
                    className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                    onClick={() => { setEditingContract(record); setIsModalOpen(true) }}
                  >
                    <Edit className="h-3 w-3 mr-1" />
                    Edit
                  </button>
                )}
                <button className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md transition-colors">
                  <MoreHorizontal className="h-4 w-4" />
                </button>
              </div>
              )
            }
          ]) as TableColumn<HardwareContract>[]}
          dataSource={paginatedContracts} // ✅ only show 10 rows per page
        />

        {/* Pagination */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-700">
              Showing <span className="font-medium">{filteredContracts.length === 0 ? 0 : startIndex + 1}</span> to <span className="font-medium">{Math.min(endIndex, filteredContracts.length)}</span> of <span className="font-medium">{filteredContracts.length}</span> contracts
            </div>
            <div className="flex items-center space-x-2">
              <button
                className="inline-flex items-center px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(prev => prev - 1)}
              >
                Previous
              </button>
              <div className="flex items-center space-x-1">
                {Array.from({ length: Math.min(5, totalPages || 1) }, (_, i) => {
                  const page = i + 1;
                  return (
                    <button
                      key={page}
                      className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                        currentPage === page
                          ? 'bg-blue-600 text-white'
                          : 'text-gray-700 hover:bg-gray-100'
                      }`}
                      onClick={() => setCurrentPage(page)}
                    >
                      {page}
                    </button>
                  );
                })}
              </div>
              <button
                className="inline-flex items-center px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                disabled={currentPage === totalPages || totalPages === 0}
                onClick={() => setCurrentPage(prev => prev + 1)}
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
