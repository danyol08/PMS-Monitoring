'use client'

import { useState, useEffect } from 'react'
import { api } from '../lib/api'
import { format } from 'date-fns'
import Link from 'next/link'
import CompletePMSModal from './CompletePMSModal'
import { eventBus, EVENTS } from '../lib/event-bus'
import { CheckCircle, Clock, AlertTriangle, Calendar, MapPin, Wrench, ChevronRight } from 'lucide-react'

interface ContractSummary {
  id: string
  sq: string
  end_user: string
  serial: string
  next_pms_schedule: string
  status: string
  contract_type: string
  days_until_maintenance: number
  branch?: string
}

export default function UpcomingMaintenance() {
  const [contracts, setContracts] = useState<ContractSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [isCompleteModalOpen, setIsCompleteModalOpen] = useState(false)
  const [selectedContract, setSelectedContract] = useState<ContractSummary | null>(null)

  useEffect(() => {
    fetchUpcomingMaintenance()
  }, [])

  const fetchUpcomingMaintenance = async () => {
    try {
      const response = await api.get('/api/contracts/upcoming?days=30')
      setContracts(response.data)
    } catch (error) {
      console.error('Error fetching upcoming maintenance:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCompletePMS = (contract: ContractSummary) => {
    setSelectedContract(contract)
    setIsCompleteModalOpen(true)
  }

  const handleCompleteSuccess = () => {
    fetchUpcomingMaintenance() // Refresh the list
    eventBus.emit(EVENTS.MAINTENANCE_COMPLETED) // Notify dashboard to refresh
  }

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-r from-blue-100 to-indigo-100 rounded-xl flex items-center justify-center">
              <Wrench className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Upcoming Maintenance</h3>
              <p className="text-sm text-gray-500">Scheduled maintenance tasks</p>
            </div>
          </div>
        </div>
        <div className="animate-pulse space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-gray-200 rounded-xl"></div>
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                <div className="h-3 bg-gray-200 rounded w-1/2"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (contracts.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-r from-green-100 to-emerald-100 rounded-xl flex items-center justify-center">
              <CheckCircle className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Upcoming Maintenance</h3>
              <p className="text-sm text-gray-500">Scheduled maintenance tasks</p>
            </div>
          </div>
        </div>
        <div className="text-center py-12">
          <div className="w-16 h-16 bg-gradient-to-r from-green-100 to-emerald-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="h-8 w-8 text-green-600" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">All caught up!</h3>
          <p className="text-gray-500">No upcoming maintenance scheduled.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gradient-to-r from-blue-100 to-indigo-100 rounded-xl flex items-center justify-center">
            <Wrench className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Upcoming Maintenance</h3>
            <p className="text-sm text-gray-500">Scheduled maintenance tasks</p>
          </div>
        </div>
        <Link
          href="/reports"
          className="inline-flex items-center px-3 py-2 text-sm font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
        >
          View all
          <ChevronRight className="ml-1 h-4 w-4" />
        </Link>
      </div>
      
      <div className="space-y-3">
        {contracts.slice(0, 5).map((contract) => {
          const isOverdue = contract.days_until_maintenance <= 0
          const isUrgent = contract.days_until_maintenance <= 7 && contract.days_until_maintenance > 0
          
          return (
            <div key={contract.id} className={`group relative p-4 rounded-xl border transition-all duration-200 hover:shadow-md ${
              isOverdue 
                ? 'bg-red-50 border-red-200 hover:border-red-300' 
                : isUrgent 
                ? 'bg-orange-50 border-orange-200 hover:border-orange-300'
                : 'bg-gray-50 border-gray-200 hover:border-gray-300'
            }`}>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-2">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                      contract.contract_type === 'hardware' 
                        ? 'bg-blue-100 text-blue-600' 
                        : 'bg-green-100 text-green-600'
                    }`}>
                      <Wrench className="h-4 w-4" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900">{contract.end_user}</h4>
                      <div className="flex items-center space-x-2 text-sm text-gray-500">
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                          {contract.contract_type}
                        </span>
                        {contract.branch && (
                          <span className="inline-flex items-center text-gray-500">
                            <MapPin className="h-3 w-3 mr-1" />
                            {contract.branch}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-4 text-sm text-gray-600">
                    <span className="flex items-center">
                      <Calendar className="h-4 w-4 mr-1" />
                      {format(new Date(contract.next_pms_schedule), 'MMM dd, yyyy')}
                    </span>
                    <span className="text-gray-300">•</span>
                    <span>Serial: {contract.serial}</span>
                  </div>
                </div>
                
                <div className="flex items-center space-x-3">
                  <div className="text-right">
                    <div className={`text-sm font-semibold ${
                      isOverdue 
                        ? 'text-red-600' 
                        : isUrgent 
                        ? 'text-orange-600' 
                        : 'text-gray-600'
                    }`}>
                      {isOverdue 
                        ? 'Overdue' 
                        : `${contract.days_until_maintenance} days`
                      }
                    </div>
                    {isOverdue && (
                      <div className="flex items-center text-xs text-red-500 mt-1">
                        <AlertTriangle className="h-3 w-3 mr-1" />
                        Action needed
                      </div>
                    )}
                  </div>
                  
                  <button
                    onClick={() => handleCompletePMS(contract)}
                    className={`px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${
                      isOverdue
                        ? 'bg-red-600 text-white hover:bg-red-700 shadow-sm'
                        : 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm'
                    }`}
                  >
                    Complete
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>
      {/* Complete PMS Modal */}
      <CompletePMSModal
        isOpen={isCompleteModalOpen}
        onClose={() => setIsCompleteModalOpen(false)}
        onSuccess={handleCompleteSuccess}
        contractId={selectedContract?.id || ''}
        contractType={(selectedContract?.contract_type as 'hardware' | 'label') || 'hardware'}
        contractTitle={selectedContract?.end_user || ''}
        currentPMSDate={selectedContract?.next_pms_schedule || new Date().toISOString()}
      />
    </div>
  )
}