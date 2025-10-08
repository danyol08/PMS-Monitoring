'use client'

import { useState } from 'react'
import { api } from '../lib/api'
import { X, CheckCircle, User, FileText } from 'lucide-react'
import Loading from '@/components/Loading'

interface CompletePMSModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  contractId: string
  contractType: 'hardware' | 'label'
  contractTitle: string
  currentPMSDate: string
}

export default function CompletePMSModal({
  isOpen,
  onClose,
  onSuccess,
  contractId,
  contractType,
  contractTitle,
  currentPMSDate
}: CompletePMSModalProps) {
  const initialFormData = {
    technician: '',
    service_report: '',
    sr_number: '',
    sales_name: '',
    location: '',
    completion_date: new Date().toISOString().split('T')[0] // Default to today
  }
  
  const [formData, setFormData] = useState(initialFormData)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const handleClose = () => {
    // Reset form data when closing
    setFormData(initialFormData)
    setError(null)
    onClose()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Prevent multiple submissions
    if (loading) return
    
    setLoading(true)
    setError(null)

    try {
      const endpoint = contractType === 'hardware' 
        ? `/api/contracts/hardware/${contractId}/complete-pms`
        : `/api/contracts/label/${contractId}/complete-pms`
      
      const params = new URLSearchParams({
        technician: formData.technician,
        ...(formData.service_report && { service_report: formData.service_report }),
        ...(formData.sr_number && { sr_number: formData.sr_number }),
        ...(formData.sales_name && { sales_name: formData.sales_name }),
        ...(formData.location && { location: formData.location }),
        ...(formData.completion_date && { completion_date: formData.completion_date })
      })

      await api.post(`${endpoint}?${params}`)
      
      onSuccess()
      handleClose() // This will reset the form and close the modal
    } catch (err: any) {
      console.error('Error completing PMS:', err)
      console.error('Full error response:', err?.response)
      const errorMessage = err?.response?.data?.detail || 
                          err?.response?.data?.message || 
                          err?.message || 
                          'Failed to complete PMS'
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-11/12 md:w-1/2 lg:w-1/3 shadow-lg rounded-md bg-white">
        {/* Loading overlay */}
        {loading && (
          <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center z-10 rounded-md">
            <div className="flex flex-col items-center space-y-2">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <p className="text-sm text-gray-600">Completing PMS...</p>
            </div>
          </div>
        )}
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center space-x-2">
            <CheckCircle className="h-5 w-5 text-green-600" />
            <h3 className="text-lg font-medium text-gray-900">
              Complete PMS Service
            </h3>
          </div>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={loading}
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Contract Info */}
        <div className="bg-gray-50 rounded-lg p-4 mb-4">
          <h4 className="font-medium text-gray-900 mb-2">{contractTitle}</h4>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-500">Contract Type:</span>
              <span className="ml-2 capitalize">{contractType}</span>
            </div>
            <div>
              <span className="text-gray-500">PMS Date:</span>
              <span className="ml-2">{new Date(currentPMSDate).toLocaleDateString()}</span>
            </div>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-4">
            <p className="text-red-600">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Technician */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <User className="h-4 w-4 inline mr-1" />
              Technical Specialist *
            </label>
            <input
              type="text"
              name="technician"
              value={formData.technician}
              onChange={handleChange}
              className="input"
              placeholder="Enter technician name"
              required
            />
          </div>

          {/* Completion Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <FileText className="h-4 w-4 inline mr-1" />
              Completion Date *
            </label>
            <input
              type="date"
              name="completion_date"
              value={formData.completion_date}
              onChange={handleChange}
              className="input"
              required
            />
            <p className="mt-1 text-xs text-gray-500">Next PMS schedule will be calculated from this date</p>
          </div>

          {/* SR Number */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <FileText className="h-4 w-4 inline mr-1" />
              SR Number*
            </label>
            <input
              type="text"
              name="sr_number"
              value={formData.sr_number}
              onChange={handleChange}
              className="input"
              placeholder="Enter SR number (e.g., SR-20241201-001)"
              required
            />
          </div>

          {/* Sales Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <User className="h-4 w-4 inline mr-1" />
              Sales Person
            </label>
            <input
              type="text"
              name="sales_name"
              value={formData.sales_name}
              onChange={handleChange}
              className="input"
              placeholder="Enter sales person name (Optional)"
            />
          </div>

          {/* Company Location */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <User className="h-4 w-4 inline mr-1" />
              Company Location*
            </label>
            <input
              type="text"
              name="location"
              value={formData.location}
              onChange={handleChange}
              className="input"
              placeholder="Enter company location (e.g., Makati, Quezon City)"
              required
            />
          </div>

          {/* Service Report */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <FileText className="h-4 w-4 inline mr-1" />
              Service Report Documentation*
            </label>
            <textarea
              name="service_report"
              value={formData.service_report}
              onChange={handleChange}
              className="input min-h-[100px]"
              placeholder="Describe the service performed, issues found, recommendations, etc. You can include links (https://...) which will be clickable in the service history."
              rows={4}
              required
            />
            <p className="mt-1 text-xs text-gray-500">
              This documentation will be saved to service history. URLs (https://...) will be automatically converted to clickable links.
            </p>
          </div>

          {/* Actions */}
          <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={loading}
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  {/* Compact barcode: reuse component without fullscreen and a shorter label */}
                  <span className="inline-block -my-1">
                    <Loading label="" />
                  </span>
                  Processing...
                </span>
              ) : (
                'Complete PMS'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
