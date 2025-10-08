'use client'

import { useState } from 'react'
import { X, CheckCircle, FileText, User } from 'lucide-react'
import { useAuth } from '../lib/auth-context'
import { eventBus, EVENTS } from '../lib/event-bus'

interface CompleteRepairModalProps {
  isOpen: boolean
  onClose: () => void
  repairId: string
  repairDetails: {
    sq: string
    company_name: string
    device_model: string
    serial_number: string
  }
  onComplete: () => void
}

export default function CompleteRepairModal({
  isOpen,
  onClose,
  repairId,
  repairDetails,
  onComplete
}: CompleteRepairModalProps) {
  const { user } = useAuth()
  const initialFormData = {
    technician: '',
    action_taken: '',
    repair_closed: new Date().toISOString().split('T')[0]
  }
  
  const [formData, setFormData] = useState(initialFormData)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleClose = () => {
    // Reset form data when closing
    setFormData(initialFormData)
    onClose()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Prevent multiple submissions
    if (isSubmitting) return
    
    if (!formData.action_taken.trim() || !formData.technician.trim() || !formData.repair_closed) return
    setIsSubmitting(true)

    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
      const response = await fetch(`${API_URL}/api/repairs/${repairId}/complete?${new URLSearchParams({
        technician: formData.technician,
        action_taken: formData.action_taken,
        completion_notes: '',
        repair_closed: new Date(formData.repair_closed).toISOString()
      })}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
          'Content-Type': 'application/json'
        }
      })

      if (response.ok) {
        onComplete()
        eventBus.emit(EVENTS.REPAIR_COMPLETED) // Notify dashboard to refresh
        handleClose() // This will reset the form and close the modal
      } else {
        const errorText = await response.text()
        let errorMessage = 'Failed to complete repair'
        try {
          const errorJson = JSON.parse(errorText)
          errorMessage = errorJson.detail || errorJson.message || errorMessage
        } catch (e) {
          errorMessage = errorText || errorMessage
        }
        alert(`Error: ${errorMessage}`)
      }
    } catch (error: any) {
      alert(`Error completing repair: ${error?.message || 'Unknown error'}`)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 relative">
        {/* Loading overlay */}
        {isSubmitting && (
          <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center z-10 rounded-lg">
            <div className="flex flex-col items-center space-y-2">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
              <p className="text-sm text-gray-600">Completing repair...</p>
            </div>
          </div>
        )}
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center">
            <CheckCircle className="h-6 w-6 text-green-600 mr-2" />
            <h3 className="text-lg font-semibold text-gray-900">Complete Repair</h3>
          </div>
          <button 
            onClick={handleClose} 
            className="text-gray-400 hover:text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={isSubmitting}
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="p-6">
          {/* Repair Details */}
          <div className="mb-6 p-4 bg-gray-50 rounded-lg">
            <h4 className="font-medium text-gray-900 mb-2">Repair Details</h4>
            <div className="space-y-1 text-sm text-gray-600">
              <p><span className="font-medium">SQ:</span> {repairDetails.sq}</p>
              <p><span className="font-medium">Company:</span> {repairDetails.company_name}</p>
              <p><span className="font-medium">Model:</span> {repairDetails.device_model}</p>
              <p><span className="font-medium">Serial:</span> {repairDetails.serial_number}</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Technician */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <User className="h-4 w-4 inline mr-1" />
                Technician *
              </label>
              <input
                type="text"
                name="technician"
                value={formData.technician}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder={`Enter technician name${user?.full_name ? ` (e.g., ${user.full_name})` : ''}`}
                required
              />
            </div>

            {/* Repair Closed */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Repair Closed Date *
              </label>
              <input
                type="date"
                name="repair_closed"
                value={formData.repair_closed}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            {/* Action Taken only */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <FileText className="h-4 w-4 inline mr-1" />
                Action Taken *
              </label>
              <textarea
                name="action_taken"
                value={formData.action_taken}
                onChange={handleChange}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Describe the work done (e.g., replaced PSU, updated firmware, reseated cables)."
                required
              />
            </div>


            <div className="flex justify-end space-x-3 pt-4">
              <button
                type="button"
                onClick={handleClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-2 text-sm font-medium text-white bg-green-600 border border-transparent rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'Completing...' : 'Mark as Done'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
