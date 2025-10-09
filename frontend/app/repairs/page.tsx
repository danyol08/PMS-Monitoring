'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth-context'
import { useRouter } from 'next/navigation'
import DashboardLayout from '../../components/DashboardLayout'
import RepairModal from '../../components/RepairModal'
import CompleteRepairModal from '../../components/CompleteRepairModal'
import ImportModal from '../../components/ImportModal'
import { Repair, RepairStatus } from '../../types/repair'
import ResponsiveTable from '../../components/ResponsiveTable'
import { Plus, Search, CheckCircle, Upload } from 'lucide-react'
import { format } from 'date-fns'
import Loading from '../../components/Loading'

export default function RepairsPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [repairs, setRepairs] = useState<Repair[]>([])
  const [loadingRepairs, setLoadingRepairs] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isCompleteModalOpen, setIsCompleteModalOpen] = useState(false)
  const [editingRepair, setEditingRepair] = useState<Repair | null>(null)
  const [completingRepair, setCompletingRepair] = useState<Repair | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [isImportModalOpen, setIsImportModalOpen] = useState(false)

  // 🔹 Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const rowsPerPage = 10

  useEffect(() => {
    if (!loading && !user) {
      router.push('/')
    }
  }, [user, loading, router])

  useEffect(() => {
    if (user) {
      fetchRepairs()
    }
  }, [user])

  const fetchRepairs = async () => {
    try {
      setLoadingRepairs(true)
      const { data, error } = await supabase
        .from('repairs')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching repairs:', error)
        return
      }

      setRepairs(data || [])
    } catch (error) {
      console.error('Error fetching repairs:', error)
    } finally {
      setLoadingRepairs(false)
    }
  }

  const handleAddRepair = () => {
    setEditingRepair(null)
    setIsModalOpen(true)
  }

  const handleEditRepair = (repair: Repair) => {
    setEditingRepair(repair)
    setIsModalOpen(true)
  }

  const handleDeleteRepair = async (repairId: string) => {
    if (!confirm('Are you sure you want to delete this repair record?')) {
      return
    }

    try {
      const { error } = await supabase
        .from('repairs')
        .delete()
        .eq('id', repairId)

      if (error) {
        console.error('Error deleting repair:', error)
        alert('Failed to delete repair record')
        return
      }

      setRepairs(repairs.filter(repair => repair.id !== repairId))
    } catch (error) {
      console.error('Error deleting repair:', error)
      alert('Failed to delete repair record')
    }
  }

  const handleModalClose = () => {
    setIsModalOpen(false)
    setEditingRepair(null)
  }

  const handleModalSave = (repair: Repair) => {
    if (editingRepair) {
      setRepairs(repairs.map(r => r.id === repair.id ? repair : r))
    } else {
      setRepairs([repair, ...repairs])
    }
    handleModalClose()
  }

  const handleCompleteRepair = (repair: Repair) => {
    setCompletingRepair(repair)
    setIsCompleteModalOpen(true)
  }

  const handleCompleteModalClose = () => {
    setIsCompleteModalOpen(false)
    setCompletingRepair(null)
  }

  const handleRepairCompleted = () => {
    fetchRepairs() // Refresh the repairs list
    handleCompleteModalClose()
  }

  const getStatusBadge = (status: RepairStatus) => {
    const statusColors = {
      received: 'bg-blue-100 text-blue-800',
      in_progress: 'bg-yellow-100 text-yellow-800',
      completed: 'bg-green-100 text-green-800',
      cancelled: 'bg-red-100 text-red-800',
      pending_parts: 'bg-orange-100 text-orange-800'
    }

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColors[status]}`}>
        {status.replace('_', ' ').toUpperCase()}
      </span>
    )
  }

  // 🔎 Local Filtering
  const filteredRepairs = repairs.filter(r => {
    const q = searchTerm.toLowerCase()
    return (
      (r.company_name?.toLowerCase() || '').includes(q) ||
      (r.device_model?.toLowerCase() || '').includes(q) ||
      (r.serial_number?.toLowerCase() || '').includes(q) ||
      (r.part_number?.toLowerCase() || '').includes(q) ||
      (r.sq?.toLowerCase() || '').includes(q)
    )
  })

  // 🔹 Pagination slice
  const totalPages = Math.ceil(filteredRepairs.length / rowsPerPage)
  const startIndex = (currentPage - 1) * rowsPerPage
  const endIndex = startIndex + rowsPerPage
  const paginatedRepairs = filteredRepairs.slice(startIndex, endIndex)

  if (loading || loadingRepairs) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loading label="Loading repairs..." />
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
            <h1 className="text-2xl font-bold text-gray-900">Repair Management</h1>
            <p className="text-gray-600">Track and manage device repairs and maintenance</p>
          </div>
          <div className="mt-4 sm:mt-0 flex items-center space-x-3">
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
              onClick={handleAddRepair}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Repair
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="card">
          <label className="block text-sm font-medium text-gray-700 mb-2">Search</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search repairs..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value)
                setCurrentPage(1) // reset to page 1 when searching
              }}
              className="input pl-10"
            />
          </div>
        </div>

        <ResponsiveTable
          minWidth={1400}
          emptyText="No repair records found"
          columns={[
            { title: 'SQ', dataIndex: 'sq', key: 'sq', render: (_v, record) => filteredRepairs.indexOf(record) + 1 },
            { title: 'Date Received', dataIndex: 'date_received', key: 'date_received', render: (v) => v ? format(new Date(v), 'MMM dd, yyyy') : '—' },
            { title: 'Company Name', dataIndex: 'company_name', key: 'company_name' },
            { title: 'Device Model', dataIndex: 'device_model', key: 'device_model' },
            { title: 'Part Number', dataIndex: 'part_number', key: 'part_number' },
            { title: 'Serial Number', dataIndex: 'serial_number', key: 'serial_number', className: 'font-mono text-sm' },
            { title: 'RMA Case', dataIndex: 'rma_case', key: 'rma_case' },
            { title: 'Status', dataIndex: 'status', key: 'status', render: (_v, r) => getStatusBadge(r.status) },
            { title: 'Repair Open', dataIndex: 'repair_open', key: 'repair_open', render: (v) => v ? format(new Date(v), 'MMM dd, yyyy') : '—' },
            {
              title: 'Actions', dataIndex: 'id', key: 'actions', render: (_v, record) => (
                <div className="flex gap-2">
                  {record.status !== 'completed' && (
                    <button 
                      className="btn btn-success btn-xs flex items-center" 
                      onClick={() => handleCompleteRepair(record)}
                    >
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Complete
                    </button>
                  )}
                  <button className="btn btn-secondary btn-xs" onClick={() => handleEditRepair(record)}>Edit</button>
                </div>
              )
            }
          ]}
          dataSource={paginatedRepairs}
        />

        {/* Pagination */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-700">
              Showing <span className="font-medium">{filteredRepairs.length === 0 ? 0 : startIndex + 1}</span> to <span className="font-medium">{Math.min(endIndex, filteredRepairs.length)}</span> of <span className="font-medium">{filteredRepairs.length}</span> repairs
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

        {/* Modals */}
        {isModalOpen && (
          <RepairModal
            repair={editingRepair}
            onClose={handleModalClose}
            onSave={handleModalSave}
          />
        )}

        {isCompleteModalOpen && completingRepair && (
          <CompleteRepairModal
            isOpen={isCompleteModalOpen}
            onClose={handleCompleteModalClose}
            repairId={completingRepair.id}
            repairDetails={{
              sq: completingRepair.sq,
              company_name: completingRepair.company_name,
              device_model: completingRepair.device_model,
              serial_number: completingRepair.serial_number
            }}
            onComplete={handleRepairCompleted}
          />
        )}

        <ImportModal
          isOpen={isImportModalOpen}
          onClose={() => setIsImportModalOpen(false)}
          onSuccess={() => { fetchRepairs(); setCurrentPage(1) }}
          importType="repairs"
          title="Repairs"
        />
      </div>
    </DashboardLayout>
  )
}
