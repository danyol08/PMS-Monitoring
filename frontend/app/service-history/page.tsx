'use client'

import { useAuth } from '../../lib/auth-context'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import DashboardLayout from '../../components/DashboardLayout'
import { api } from '../../lib/api'
import { format } from 'date-fns'
import { Plus, Search, Filter, Calendar, Clock, CheckCircle, XCircle, Download, FileText, Eye, ExternalLink, Upload } from 'lucide-react'
import Loading from '../../components/Loading'
import ImportModal from '../../components/ImportModal'
import AddServiceHistoryModal from '../../components/AddServiceHistoryModal'

interface ServiceHistory {
  id: string
  contract_id: string
  contract_type: string
  service_date: string
  service_type: string
  description: string
  technician: string
  status: string
  service_report?: string
  attachments?: string[]
  created_at: string
  // Additional fields for the new table format
  company?: string
  location?: string
  model?: string
  serial?: string
  sales?: string
  sr_number?: string
}

// Utility function to convert URLs to clickable links
const convertLinksToClickable = (text: string) => {
  if (!text) return text
  
  // Enhanced URL regex pattern to handle various URL formats
  const urlRegex = /(https?:\/\/[^\s<>"{}|\\^`[\]]+)/g
  
  // Split text by URLs and create clickable links
  const parts = text.split(urlRegex)
  
  return parts.map((part, index) => {
    if (urlRegex.test(part)) {
      // Clean up URL (remove trailing punctuation that might not be part of URL)
      const cleanUrl = part.replace(/[.,;:!?]+$/, '')
      const trailingPunctuation = part.slice(cleanUrl.length)
      
      return (
        <span key={index}>
          <a
            href={cleanUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:text-blue-800 underline inline-flex items-center gap-1 break-all"
          >
            {cleanUrl}
            <ExternalLink className="h-3 w-3 flex-shrink-0" />
          </a>
          {trailingPunctuation}
        </span>
      )
    }
    return part
  })
}

export default function ServiceHistory() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [serviceHistory, setServiceHistory] = useState<ServiceHistory[]>([])
  const [loadingHistory, setLoadingHistory] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')
  const [monthFilter, setMonthFilter] = useState('')
  const [exporting, setExporting] = useState(false)
  const [selectedService, setSelectedService] = useState<ServiceHistory | null>(null)
  const [showReportModal, setShowReportModal] = useState(false)
  const [isImportModalOpen, setIsImportModalOpen] = useState(false)
  const [isAddServiceHistoryModalOpen, setIsAddServiceHistoryModalOpen] = useState(false)
  
  // Pagination states
  const [currentPage, setCurrentPage] = useState(1)
  const [rowsPerPage, setRowsPerPage] = useState(10)
  const [goToPage, setGoToPage] = useState('')

  useEffect(() => {
    if (!loading && !user) {
      router.push('/')
    }
  }, [user, loading, router])

  useEffect(() => {
    if (user) {
      fetchServiceHistory()
    }
  }, [user])

  const fetchServiceHistory = async () => {
    try {
      const params = new URLSearchParams()
      if (monthFilter) {
        params.append('month', monthFilter)
      }
      // No pagination parameters - get all records
      
      const url = `/api/reports/service-history/combined${params.toString() ? `?${params.toString()}` : ''}`
      const response = await api.get(url)
      setServiceHistory(response.data)
    } catch (error) {
      console.error('Error fetching service history:', error)
    } finally {
      setLoadingHistory(false)
    }
  }

  // Sort service history by service_date (most recent first), then by created_at as fallback
  const sortedHistory = [...serviceHistory].sort((a, b) => {
    // Primary sort: service_date (most recent first)
    const dateA = new Date(a.service_date).getTime()
    const dateB = new Date(b.service_date).getTime()
    
    if (dateA !== dateB) {
      return dateB - dateA // Most recent first
    }
    
    // Secondary sort: created_at (most recent first) if service dates are the same
    const createdA = new Date(a.created_at).getTime()
    const createdB = new Date(b.created_at).getTime()
    return createdB - createdA
  })

  const filteredHistory = sortedHistory.filter(service => {
    const matchesSearch = service.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         service.technician.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         service.service_type.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         service.contract_type.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (service.company && service.company.toLowerCase().includes(searchTerm.toLowerCase())) ||
                         (service.location && service.location.toLowerCase().includes(searchTerm.toLowerCase())) ||
                         (service.model && service.model.toLowerCase().includes(searchTerm.toLowerCase())) ||
                         (service.serial && service.serial.toLowerCase().includes(searchTerm.toLowerCase())) ||
                         (service.sales && service.sales.toLowerCase().includes(searchTerm.toLowerCase())) ||
                         (service.sr_number && service.sr_number.toLowerCase().includes(searchTerm.toLowerCase()))
    
    const matchesStatus = statusFilter === 'all' || service.status === statusFilter
    const matchesType = typeFilter === 'all' || service.contract_type === typeFilter
    
    return matchesSearch && matchesStatus && matchesType
  })

  // Pagination calculations
  const totalPages = Math.ceil(filteredHistory.length / rowsPerPage)
  const paginatedHistory = filteredHistory.slice(
    (currentPage - 1) * rowsPerPage,
    currentPage * rowsPerPage
  )

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1)
    setGoToPage('')
  }, [searchTerm, statusFilter, typeFilter, rowsPerPage, monthFilter])

  // Refetch data when month filter changes
  useEffect(() => {
    if (user && monthFilter !== undefined) {
      fetchServiceHistory()
    }
  }, [monthFilter, user])

  const handleGoToPage = (e: React.FormEvent) => {
    e.preventDefault()
    const pageNum = parseInt(goToPage)
    if (pageNum >= 1 && pageNum <= totalPages) {
      setCurrentPage(pageNum)
      setGoToPage('')
    }
  }

  // Generate month options for the last 12 months
  const generateMonthOptions = () => {
    const options = []
    const currentDate = new Date()
    
    for (let i = 0; i < 12; i++) {
      const date = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1)
      const value = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`
      const label = date.toLocaleDateString('en-US', { year: 'numeric', month: 'long' })
      options.push({ value, label })
    }
    
    return options
  }

  const exportServiceHistory = async (format: 'excel' | 'pdf') => {
    setExporting(true)
    try {
      const params = new URLSearchParams()
      if (monthFilter) {
        params.append('month', monthFilter)
      }
      
      const exportUrl = `/api/reports/service-history/export/${format}${params.toString() ? `?${params.toString()}` : ''}`
      const response = await api.get(exportUrl, {
        responseType: 'blob'
      })
      
      const blob = new Blob([response.data])
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      
      // Generate filename with month if filtered
      let filename = 'service_history'
      if (monthFilter) {
        const monthName = generateMonthOptions().find(opt => opt.value === monthFilter)?.label || monthFilter
        filename = `service_history_${monthName.replace(' ', '_')}`
      }
      link.download = `${filename}.${format === 'excel' ? 'xlsx' : 'pdf'}`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
    } catch (error) {
      console.error(`Error exporting ${format}:`, error)
      alert(`Failed to export ${format} file`)
    } finally {
      setExporting(false)
    }
  }



  if (loading || loadingHistory) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loading label="Loading service history..." />
      </div>
    )
  }

  if (!user) {
    return null
  }

  return (
    <DashboardLayout>
      <div className="space-y-5">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Service History</h1>
            <p className="text-sm text-gray-600">Track all maintenance service records</p>
          </div>
          <div className="mt-3 sm:mt-0 flex flex-col sm:flex-row gap-3">
            {/* <button
              type="button"
              onClick={() => setIsAddServiceHistoryModalOpen(true)}
              className="group relative inline-flex items-center justify-center px-6 py-3 text-sm font-semibold text-white bg-gradient-to-r from-purple-600 to-pink-600 border border-transparent rounded-xl hover:from-purple-700 hover:to-pink-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl opacity-0 group-hover:opacity-20 transition-opacity duration-200"></div>
              <Plus className="h-5 w-5 mr-2 group-hover:rotate-90 transition-transform duration-200" />
              <span className="relative z-10">Add Service History</span>
            </button> */}
            
            <button
              type="button"
              onClick={() => setIsImportModalOpen(true)}
              className="group relative inline-flex items-center justify-center px-6 py-3 text-sm font-semibold text-white bg-gradient-to-r from-green-600 to-emerald-600 border border-transparent rounded-xl hover:from-green-700 hover:to-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-green-600 to-emerald-600 rounded-xl opacity-0 group-hover:opacity-20 transition-opacity duration-200"></div>
              <Upload className="h-5 w-5 mr-2 group-hover:rotate-12 transition-transform duration-200" />
              <span className="relative z-10">Import Excel</span>
            </button>
            
            <button 
              type="button"
              onClick={() => exportServiceHistory('excel')}
              disabled={exporting}
              className="group relative inline-flex items-center justify-center px-6 py-3 text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-indigo-600 border border-transparent rounded-xl hover:from-blue-700 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl opacity-0 group-hover:opacity-20 transition-opacity duration-200"></div>
              <Download className={`h-5 w-5 mr-2 group-hover:-translate-y-1 transition-transform duration-200 ${exporting ? 'animate-bounce' : ''}`} />
              <span className="relative z-10">
                {exporting ? 'Exporting...' : 'Export Excel'}
              </span>
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white p-3 rounded-lg shadow">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search service records..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="input pl-10 py-2 text-sm"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Month</label>
              <select
                value={monthFilter}
                onChange={(e) => setMonthFilter(e.target.value)}
                className="input py-2 text-sm"
              >
                <option value="">All Months</option>
                {generateMonthOptions().map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="input py-2 text-sm"
              >
                <option value="all">All Status</option>
                <option value="completed">Completed</option>
                <option value="pending">Pending</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Contract Type</label>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="input py-2 text-sm"
              >
                <option value="all">All Types</option>
                <option value="hardware">Hardware</option>
                <option value="label">Label</option>
                <option value="repair">Repair</option>
              </select>
            </div>
          </div>
        </div>

        {/* Service History Table */}
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-blue-600">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-white uppercase tracking-wider">
                    COMPANY | LOCATION
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-white uppercase tracking-wider">
                    TYPE
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-white uppercase tracking-wider">
                    MODEL
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-white uppercase tracking-wider">
                    SERIAL
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-white uppercase tracking-wider">
                    DATE OF PMS
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-white uppercase tracking-wider">
                    TECHNICAL MEMBER
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-white uppercase tracking-wider">
                    SALES
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-white uppercase tracking-wider">
                    SR
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-white uppercase tracking-wider">
                    SERVICE REPORT
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
          {paginatedHistory.map((service, index) => (
                  <tr key={service.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {service.company || 'N/A'}
                      </div>
                      <div className="text-xs text-gray-500">
                        {service.location || 'N/A'}
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${
                        service.contract_type === 'hardware' 
                          ? 'bg-blue-100 text-blue-800' 
                          : service.contract_type === 'label'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'  // repair
                    }`}>
                      {service.contract_type}
                    </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                      {service.model || 'N/A'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                      {service.serial || 'N/A'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                      {format(new Date(service.service_date), 'MMM dd, yyyy')}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                      {service.technician}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                      {service.sales || 'N/A'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                      {service.sr_number || 'N/A'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 max-w-xs">
                      {service.service_report && service.service_report.trim() ? (
                        <div className="flex items-center space-x-2">
                          <div className="truncate flex-1" title={service.service_report}>
                            {service.service_report.length > 30 
                              ? `${service.service_report.substring(0, 30)}...` 
                              : service.service_report}
                          </div>
                          <div className="flex items-center space-x-1">
                            {/* Show link icon if there are URLs in the service report */}
                            {/(https?:\/\/[^\s<>"{}|\\^`[\]]+)/g.test(service.service_report) && (
                              <ExternalLink className="h-3 w-3 text-blue-500"  />
                            )}
                            <button
                              onClick={() => {
                                setSelectedService(service)
                                setShowReportModal(true)
                              }}
                              className="text-blue-600 hover:text-blue-800 p-1 rounded"
                              title="View full service report"
                            >
                              <Eye className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <span className="text-gray-400">No report</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
        </div>

        {filteredHistory.length === 0 && (
          <div className="text-center py-12">
            <Clock className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">No service records found</p>
          </div>
        )}

        {/* Pagination */}
        {filteredHistory.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
          <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
            <div className="text-sm text-gray-700">
                  Showing <span className="font-medium">
                    {filteredHistory.length === 0 ? 0 : (currentPage - 1) * rowsPerPage + 1}
                  </span> to <span className="font-medium">
                    {Math.min(currentPage * rowsPerPage, filteredHistory.length)}
                  </span> of <span className="font-medium">{filteredHistory.length}</span> records
                </div>
                
                {/* Rows per page selector */}
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-600">Show:</span>
                  <select
                    value={rowsPerPage}
                    onChange={(e) => setRowsPerPage(Number(e.target.value))}
                    className="text-sm border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value={5}>5</option>
                    <option value={10}>10</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                  <span className="text-sm text-gray-600">per page</span>
                </div>
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
                  {totalPages <= 7 ? (
                    // Show all pages if 7 or fewer
                    Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                      <button
                        key={page}
                        onClick={() => setCurrentPage(page)}
                        className={`px-3 py-2 text-sm font-medium rounded-lg ${
                          page === currentPage 
                            ? 'bg-blue-600 text-white' 
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        {page}
                      </button>
                    ))
                  ) : (
                    // Show pagination with ellipsis for many pages
                    <>
                      {/* First page */}
                      <button
                        onClick={() => setCurrentPage(1)}
                        className={`px-3 py-2 text-sm font-medium rounded-lg ${
                          currentPage === 1 
                            ? 'bg-blue-600 text-white' 
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        1
                      </button>

                      {/* Left ellipsis */}
                      {currentPage > 3 && (
                        <span className="px-2 py-2 text-sm text-gray-500">...</span>
                      )}

                      {/* Current page and neighbors */}
                      {Array.from({ length: 3 }, (_, i) => currentPage - 1 + i)
                        .filter(page => page > 1 && page < totalPages)
                        .map(page => (
                          <button
                            key={page}
                            onClick={() => setCurrentPage(page)}
                            className={`px-3 py-2 text-sm font-medium rounded-lg ${
                              page === currentPage 
                                ? 'bg-blue-600 text-white' 
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                          >
                            {page}
                          </button>
                        ))}

                      {/* Right ellipsis */}
                      {currentPage < totalPages - 2 && (
                        <span className="px-2 py-2 text-sm text-gray-500">...</span>
                      )}

                      {/* Last page */}
                      {totalPages > 1 && (
                        <button
                          onClick={() => setCurrentPage(totalPages)}
                          className={`px-3 py-2 text-sm font-medium rounded-lg ${
                            currentPage === totalPages 
                              ? 'bg-blue-600 text-white' 
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                        >
                          {totalPages}
                        </button>
                      )}
                    </>
                  )}
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
            
            {/* Go to page input for many pages */}
            {totalPages > 7 && (
              <div className="mt-4 flex items-center justify-center">
                <form onSubmit={handleGoToPage} className="flex items-center space-x-2">
                  <span className="text-sm text-gray-600">Go to page:</span>
                  <input
                    type="number"
                    min="1"
                    max={totalPages}
                    value={goToPage}
                    onChange={(e) => setGoToPage(e.target.value)}
                    className="w-16 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="1"
                  />
                  <button
                    type="submit"
                    className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    Go
                  </button>
                </form>
              </div>
            )}
          </div>
        )}

        {/* Service Report Modal */}
        {showReportModal && selectedService && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
            <div className="relative top-20 mx-auto p-5 border w-11/12 md:w-3/4 lg:w-1/2 shadow-lg rounded-md bg-white">
              <div className="flex justify-between items-center mb-4">
                <div className="flex items-center space-x-2">
                  <FileText className="h-5 w-5 text-blue-600" />
                  <h3 className="text-lg font-medium text-gray-900">
                    Service Report Details
                  </h3>
                  {selectedService.service_report && /(https?:\/\/[^\s<>"{}|\\^`[\]]+)/g.test(selectedService.service_report) && (
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      <ExternalLink className="h-3 w-3 mr-1" />
                      Contains Links
                    </span>
                  )}
                </div>
                <button
                  onClick={() => {
                    setShowReportModal(false)
                    setSelectedService(null)
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <XCircle className="h-6 w-6" />
                </button>
              </div>

              {/* Service Info */}
              <div className="bg-gray-50 rounded-lg p-4 mb-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500">Company:</span>
                    <span className="ml-2 font-medium">{selectedService.company || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Location:</span>
                    <span className="ml-2 font-medium">{selectedService.location || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Model:</span>
                    <span className="ml-2 font-medium">{selectedService.model || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Serial:</span>
                    <span className="ml-2 font-medium">{selectedService.serial || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Service Date:</span>
                    <span className="ml-2 font-medium">{format(new Date(selectedService.service_date), 'MMM dd, yyyy')}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Technician:</span>
                    <span className="ml-2 font-medium">{selectedService.technician}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">SR Number:</span>
                    <span className="ml-2 font-medium">{selectedService.sr_number || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Sales:</span>
                    <span className="ml-2 font-medium">{selectedService.sales || 'N/A'}</span>
                  </div>
                </div>
              </div>

              {/* Service Report Content */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Service Report Documentation:
                </label>
                <div className="bg-white border border-gray-300 rounded-md p-4 min-h-[200px] max-h-[400px] overflow-y-auto">
                  {selectedService.service_report && selectedService.service_report.trim() ? (
                    <div className="whitespace-pre-wrap text-sm text-gray-900 leading-relaxed">
                      {convertLinksToClickable(selectedService.service_report)}
                    </div>
                  ) : (
                    <div className="text-gray-500 italic">No service report documentation available</div>
                  )}
          </div>
        </div>

              {/* Actions */}
              <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200 mt-4">
                <button
                  onClick={() => {
                    setShowReportModal(false)
                    setSelectedService(null)
                  }}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        <ImportModal
          isOpen={isImportModalOpen}
          onClose={() => setIsImportModalOpen(false)}
          onSuccess={() => { fetchServiceHistory(); setCurrentPage(1) }}
          importType="service-history"
          title="Service History"
        />

        <AddServiceHistoryModal
          isOpen={isAddServiceHistoryModalOpen}
          onClose={() => setIsAddServiceHistoryModalOpen(false)}
          onSuccess={() => { fetchServiceHistory(); setCurrentPage(1) }}
        />
      </div>
    </DashboardLayout>
  )
}





