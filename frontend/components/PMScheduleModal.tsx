'use client'

import { useState, useEffect } from 'react'
import { api } from '@/lib/api'
import { X, Calendar, Clock } from 'lucide-react'

interface PMScheduleModalProps {
  isOpen: boolean
  onClose: () => void
  contractId: string
  contractType: 'hardware' | 'label'
  contractTitle: string
}

interface PMScheduleData {
  contract_id: string
  contract_type: string
  contract_date: string
  end_date: string
  pms_schedules: string[]
  total_schedules: number
}

export default function PMScheduleModal({
  isOpen,
  onClose,
  contractId,
  contractType,
  contractTitle
}: PMScheduleModalProps) {
  const [scheduleData, setScheduleData] = useState<PMScheduleData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen && contractId) {
      fetchPMSchedule()
    }
  }, [isOpen, contractId])

  const fetchPMSchedule = async () => {
    setLoading(true)
    setError(null)
    
    try {
      const endpoint = contractType === 'hardware' 
        ? `/api/contracts/hardware/${contractId}/pms-schedule`
        : `/api/contracts/label/${contractId}/pms-schedule`
      
      const response = await api.get(endpoint)
      setScheduleData(response.data)
    } catch (err: any) {
      console.error('Error fetching PMS schedule:', err)
      setError(err?.response?.data?.detail || 'Failed to fetch PMS schedule')
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  const getIntervalText = () => {
    return contractType === 'hardware' ? 'every 3 months' : 'every 1 month'
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-11/12 md:w-3/4 lg:w-1/2 shadow-lg rounded-md bg-white">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center space-x-2">
            <Calendar className="h-5 w-5 text-blue-600" />
            <h3 className="text-lg font-medium text-gray-900">
              PMS Schedule - {contractTitle}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {loading && (
          <div className="flex justify-center items-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-4">
            <p className="text-red-600">{error}</p>
          </div>
        )}

        {scheduleData && (
          <div className="space-y-4">
            {/* Contract Info */}
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">Contract Start</label>
                  <p className="text-gray-900">{formatDate(scheduleData.contract_date)}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Contract End</label>
                  <p className="text-gray-900">{formatDate(scheduleData.end_date)}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Schedule Interval</label>
                  <p className="text-gray-900 capitalize">{getIntervalText()}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Total PMS Sessions</label>
                  <p className="text-gray-900 font-semibold">{scheduleData.total_schedules}</p>
                </div>
              </div>
            </div>

            {/* PMS Schedule List */}
            <div>
              <h4 className="text-md font-medium text-gray-900 mb-3 flex items-center">
                <Clock className="h-4 w-4 mr-2" />
                Scheduled PMS Dates
              </h4>
              
              {scheduleData.pms_schedules.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Calendar className="h-12 w-12 mx-auto mb-2 text-gray-300" />
                  <p>No PMS schedules generated</p>
                </div>
              ) : (
                <div className="max-h-96 overflow-y-auto">
                  <div className="space-y-2">
                    {scheduleData.pms_schedules.map((schedule, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg hover:bg-gray-50"
                      >
                        <div className="flex items-center space-x-3">
                          <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                            <span className="text-sm font-medium text-blue-600">
                              {index + 1}
                            </span>
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">
                              {formatDate(schedule)}
                            </p>
                            <p className="text-sm text-gray-500">
                              PMS Session #{index + 1}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            Scheduled
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end space-x-3 pt-6 border-t border-gray-200 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
