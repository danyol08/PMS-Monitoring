'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useRouter } from 'next/navigation'
import DashboardLayout from '../../components/DashboardLayout'
import PageHeader from '../../components/PageHeader'
import Breadcrumbs from '../../components/Breadcrumbs'
import EmptyState from '../../components/EmptyState'
import Loading from '../../components/Loading'
import { api } from '@/lib/api'
import { format } from 'date-fns'
import { 
  Search, 
  Filter, 
  Download, 
  Eye, 
  User, 
  Shield, 
  Settings, 
  Wrench,
  ClipboardList,
  Calendar,
  Activity,
  TrendingUp
} from 'lucide-react'

interface AuditTrail {
  id: string
  entity_type: string
  entity_id: string
  action: string
  description: string
  ip_address?: string
  created_by: string
  created_at: string
  user_name?: string
}

interface AuditStats {
  total_activities: number
  date_range: {
    start: string
    end: string
    days: number
  }
  by_entity_type: Record<string, number>
  by_action: Record<string, number>
}

export default function AuditPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [auditTrails, setAuditTrails] = useState<AuditTrail[]>([])
  const [loadingAudits, setLoadingAudits] = useState(true)
  const [stats, setStats] = useState<AuditStats | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [entityTypeFilter, setEntityTypeFilter] = useState('all')
  const [actionFilter, setActionFilter] = useState('all')
  const [selectedDate, setSelectedDate] = useState('')
  const [selectedTrail, setSelectedTrail] = useState<AuditTrail | null>(null)
  const [showDetailsModal, setShowDetailsModal] = useState(false)

  useEffect(() => {
    if (!loading && !user) {
      router.push('/')
    }
  }, [user, loading, router])

  useEffect(() => {
    if (user && user.role !== 'admin') {
      router.push('/dashboard')
    }
  }, [user, router])

  useEffect(() => {
    if (user && user.role === 'admin') {
      fetchAuditTrails()
      fetchAuditStats()
    }
  }, [user, searchTerm, entityTypeFilter, actionFilter, selectedDate])

  const fetchAuditTrails = async () => {
    try {
      setLoadingAudits(true)
      const params: any = {
        entity_type: entityTypeFilter !== 'all' ? entityTypeFilter : undefined,
        action: actionFilter !== 'all' ? actionFilter : undefined,
        limit: 100
      }

      // Add date filter if provided
      if (selectedDate) {
        const startOfDay = new Date(selectedDate)
        startOfDay.setHours(0, 0, 0, 0)
        
        const endOfDay = new Date(selectedDate)
        endOfDay.setHours(23, 59, 59, 999)
        
        params.start_date = startOfDay.toISOString()
        params.end_date = endOfDay.toISOString()
      }

      const response = await api.get('/api/audit/trails', { params })
      setAuditTrails(response.data || [])
    } catch (error) {
      console.error('Error fetching audit trails:', error)
    } finally {
      setLoadingAudits(false)
    }
  }

  const fetchAuditStats = async () => {
    try {
      const response = await api.get('/api/audit/stats', {
        params: { days: parseInt(dateRange) }
      })
      setStats(response.data)
    } catch (error) {
      console.error('Error fetching audit stats:', error)
    }
  }

  const filteredTrails = auditTrails.filter(trail => {
    const matchesSearch = 
      trail.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      trail.entity_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      trail.user_name?.toLowerCase().includes(searchTerm.toLowerCase())
    
    return matchesSearch
  })

  const getEntityIcon = (entityType: string) => {
    switch (entityType) {
      case 'hardware_contract':
        return <ClipboardList className="h-4 w-4" />
      case 'label_contract':
        return <ClipboardList className="h-4 w-4" />
      case 'repair':
        return <Wrench className="h-4 w-4" />
      case 'user':
        return <User className="h-4 w-4" />
      default:
        return <Activity className="h-4 w-4" />
    }
  }

  const getActionColor = (action: string) => {
    switch (action) {
      case 'create':
        return 'bg-green-100 text-green-800'
      case 'update':
        return 'bg-blue-100 text-blue-800'
      case 'delete':
        return 'bg-red-100 text-red-800'
      case 'view':
        return 'bg-gray-100 text-gray-800'
      case 'login':
        return 'bg-purple-100 text-purple-800'
      case 'logout':
        return 'bg-orange-100 text-orange-800'
      case 'activate':
        return 'bg-emerald-100 text-emerald-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const handleViewDetails = (trail: AuditTrail) => {
    setSelectedTrail(trail)
    setShowDetailsModal(true)
  }

  const closeDetailsModal = () => {
    setShowDetailsModal(false)
    setSelectedTrail(null)
  }

  if (loading || loadingAudits) {
    return (
      <DashboardLayout>
        <PageHeader title="Audit Trail" subtitle="Track all system activities and user actions">
          <Breadcrumbs />
        </PageHeader>
        <Loading label="Loading audit trails..." fullscreen />
      </DashboardLayout>
    )
  }

  if (!user || user.role !== 'admin') {
    return null
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <PageHeader title="Audit Trail" subtitle="Track all system activities and user actions" actions={
          <button className="btn btn-secondary flex items-center">
            <Download className="h-4 w-4 mr-2" />
            Export
          </button>
        }>
          <Breadcrumbs />
        </PageHeader>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white p-6 rounded-lg shadow">
              <div className="flex items-center">
                <Activity className="h-8 w-8 text-blue-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">Total Activities</p>
                  <p className="text-2xl font-semibold text-gray-900">{stats.total_activities}</p>
                </div>
              </div>
            </div>
            
            <div className="bg-white p-6 rounded-lg shadow">
              <div className="flex items-center">
                <Calendar className="h-8 w-8 text-green-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">Date Range</p>
                  <p className="text-2xl font-semibold text-gray-900">{stats.date_range.days} days</p>
                </div>
              </div>
            </div>
            
            <div className="bg-white p-6 rounded-lg shadow">
              <div className="flex items-center">
                <TrendingUp className="h-8 w-8 text-purple-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">Entity Types</p>
                  <p className="text-2xl font-semibold text-gray-900">{Object.keys(stats.by_entity_type).length}</p>
                </div>
              </div>
            </div>
            
            <div className="bg-white p-6 rounded-lg shadow">
              <div className="flex items-center">
                <Shield className="h-8 w-8 text-red-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">Actions</p>
                  <p className="text-2xl font-semibold text-gray-900">{Object.keys(stats.by_action).length}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search activities..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="input pl-10"
                />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Entity Type</label>
              <select
                value={entityTypeFilter}
                onChange={(e) => setEntityTypeFilter(e.target.value)}
                className="input"
              >
                <option value="all">All Types</option>
                <option value="hardware_contract">Hardware Contracts</option>
                <option value="label_contract">Label Contracts</option>
                <option value="repair">Repairs</option>
                <option value="user">Users</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Action</label>
              <select
                value={actionFilter}
                onChange={(e) => setActionFilter(e.target.value)}
                className="input"
              >
                <option value="all">All Actions</option>
                <option value="create">Create</option>
                <option value="update">Update</option>
                <option value="delete">Delete</option>
                <option value="view">View</option>
                <option value="login">Login</option>
                <option value="logout">Logout</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Date Filter</label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="input"
              />
            </div>
          </div>
        </div>

        {/* Audit Trails Table */}
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              {/* Table Header */}
              <thead className="bg-gray-50">
                <tr className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <th className="px-4 py-3 text-left">Action</th>
                  <th className="px-4 py-3 text-left">User</th>
                  <th className="px-4 py-3 text-left">Date</th>
                  <th className="px-4 py-3 text-left">IP Address</th>
                </tr>
              </thead>

              {/* Table Body */}
              <tbody className="divide-y divide-gray-200 text-sm text-gray-700">
                {filteredTrails.map((trail) => (
                  <tr key={trail.id} className="hover:bg-gray-50">
                    {/* Description */}
                    <td className="px-4 py-3">
                      <div className="flex items-center">
                        {getEntityIcon(trail.entity_type)}
                        <span className="ml-2">{trail.description}</span>
                      </div>
                    </td>

                    {/* User */}
                    <td className="px-4 py-3 font-medium">
                      {trail.user_name || 'System'}
                    </td>

                    {/* Date */}
                    <td className="px-4 py-3 text-gray-500">
                      {format(new Date(trail.created_at), 'MMM dd, yyyy HH:mm')}
                    </td>

                    {/* IP Address */}
                    <td className="px-4 py-3 text-gray-500">
                      {trail.ip_address || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Empty State */}
          {filteredTrails.length === 0 && (
            <EmptyState
              title="No audit trails found"
              description="Activities will appear here after users perform actions."
            />
          )}
        </div>

        {/* Pagination / Footer */}
        <div className="flex items-center justify-between mt-3">
          <div className="text-sm text-gray-700">
            Showing {filteredTrails.length} audit trails
          </div>
        </div>

        {/* Details Modal */}
        {showDetailsModal && selectedTrail && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-lg w-full mx-4">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Activity Details</h3>
                <button
                  onClick={closeDetailsModal}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Action</label>
                  <p className="mt-1 text-sm text-gray-900">{selectedTrail.description}</p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700">User</label>
                  <p className="mt-1 text-sm text-gray-900">{selectedTrail.user_name || 'System'}</p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700">Date</label>
                  <p className="mt-1 text-sm text-gray-900">{format(new Date(selectedTrail.created_at), 'MMM dd, yyyy HH:mm:ss')}</p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700">IP Address</label>
                  <p className="mt-1 text-sm text-gray-900">{selectedTrail.ip_address || '—'}</p>
                </div>
              </div>
              
              <div className="mt-6 flex justify-end">
                <button
                  onClick={closeDetailsModal}
                  className="btn btn-secondary"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
