'use client'

import { useAuth } from '../../../lib/auth-context'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import DashboardLayout from '@/components/DashboardLayout'
import { api } from '../../../lib/api'
import { supabase } from '../../../lib/supabase'
import { format } from 'date-fns'
import { Plus, Search, Upload } from 'lucide-react'
import ResponsiveTable from '@/components/ResponsiveTable'
import LabelContractModal from '@/components/LabelContractModal'
import ImportModal from '@/components/ImportModal'
import { LabelContract } from '@/types/label-contract'
import Loading from '@/components/Loading'

export default function LabelContracts() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [contracts, setContracts] = useState<LabelContract[]>([])
  const [loadingContracts, setLoadingContracts] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingContract, setEditingContract] = useState<LabelContract | null>(null)
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
      console.log('Fetching label contracts...')
      const response = await api.get('/api/contracts/label')
      console.log('Label contracts response:', response.data)
      setContracts(response.data || [])
    } catch (error) {
      console.error('Error fetching contracts:', error)
      try {
        const { data, error: supabaseError } = await supabase
          .from('label_contracts')
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

  const filteredContracts = contracts.filter(contract => {
    const q = searchTerm.toLowerCase()
    return (
      contract.sq.toLowerCase().includes(q) ||
      contract.end_user.toLowerCase().includes(q) ||
      contract.part_number.toLowerCase().includes(q) ||
      contract.serial.toLowerCase().includes(q)
    )
  })

  // 🟢 Paginate filtered results
  const startIndex = (currentPage - 1) * rowsPerPage
  const endIndex = startIndex + rowsPerPage
  const paginatedContracts = filteredContracts.slice(startIndex, endIndex)
  const totalPages = Math.ceil(filteredContracts.length / rowsPerPage)

  const handleAddContract = () => {
    setEditingContract(null)
    setIsModalOpen(true)
  }

  const handleEditContract = (contract: LabelContract) => {
    setEditingContract(contract)
    setIsModalOpen(true)
  }


  const handleModalClose = () => {
    setIsModalOpen(false)
    setEditingContract(null)
  }

  const handleModalSave = (contract: LabelContract) => {
    if (editingContract) {
      setContracts(contracts.map(c => c.id === contract.id ? contract : c))
    } else {
      setContracts([contract, ...contracts])
    }
    handleModalClose()
  }

  if (loading || loadingContracts) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loading label="Loading label contracts..." />
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
            <h1 className="text-2xl font-bold text-gray-900">Label Contracts</h1>
            <p className="text-gray-600">Manage your label maintenance contracts</p>
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
                  className="btn btn-primary flex items-center"
                  onClick={handleAddContract}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Contract
                </button>
              </>
            )}
          </div>
        </div>

        {/* Search */}
        <div className="card">
          <label className="block text-sm font-medium text-gray-700 mb-2">Search</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search contracts..."
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1) }}
              className="input pl-10"
            />
          </div>
        </div>

        <ResponsiveTable
          minWidth={1800}
          emptyText="No contracts found"
          columns={[
            { title: 'SQ', dataIndex: 'sq', key: 'sq', className: 'text-center', render: (_v, record) => filteredContracts.indexOf(record) + 1 },
            { title: 'End User', dataIndex: 'end_user', key: 'end_user' },
            { title: 'Part Number', dataIndex: 'part_number', key: 'part_number' },
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
            { title: 'Actions', dataIndex: 'id', key: 'actions', render: (_v, record) => (
              <div className="flex gap-2">
                {(user?.role === 'admin' || user?.role === 'technician') && (
                  <button className="btn btn-secondary btn-xs" onClick={() => handleEditContract(record)}>Edit</button>
                )}
              </div>
            )}
          ]}
          dataSource={paginatedContracts}
        />

        {/* Pagination */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-700">
              Showing <span className="font-medium">{filteredContracts.length === 0 ? 0 : startIndex + 1}</span> to <span className="font-medium">{Math.min(endIndex, filteredContracts.length)}</span> of <span className="font-medium">{filteredContracts.length}</span> contracts
            </div>
            <div className="flex items-center space-x-2">
              <button
                className="btn btn-secondary text-sm"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(prev => prev - 1)}
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
                onClick={() => setCurrentPage(prev => prev + 1)}
              >
                Next
              </button>
            </div>
          </div>
        </div>

        {/* Modal */}
        {isModalOpen && (
          <LabelContractModal
            contract={editingContract}
            onClose={handleModalClose}
            onSave={handleModalSave}
          />
        )}

        <ImportModal
          isOpen={isImportModalOpen}
          onClose={() => setIsImportModalOpen(false)}
          onSuccess={() => { fetchContracts(); setCurrentPage(1) }}
          importType="label"
          title="Label Contracts"
        />

      </div>
    </DashboardLayout>
  )
}
