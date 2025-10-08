'use client'

import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { X, Save, AlertCircle, CheckCircle, Calendar, User, Building, Wrench, FileText } from 'lucide-react'

interface AddHardwareContractModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  contract?: any
}

export default function AddHardwareContractModal({
  isOpen,
  onClose,
  onSuccess,
  contract,
}: AddHardwareContractModalProps) {
  const [formData, setFormData] = useState({
    sq: '',
    end_user: '',
    model: '',
    serial: '',
    next_pms_schedule: '',
    branch: '',
    technical_specialist: '',
    date_of_contract: '',
    end_of_contract: '',
    status: 'active',
    po_number: '',
    service_report: '',
    history: '',
    frequency: 'quarterly',
    documentation: '',
  })
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<{[key: string]: string}>({})

  // Prefill when editing
  useEffect(() => {
    if (isOpen && contract) {
      const toDateInput = (v?: string) => (v ? new Date(v).toISOString().slice(0, 10) : '')
      setFormData({
        sq: contract.sq || '',
        end_user: contract.end_user || '',
        model: contract.model || '',
        serial: contract.serial || '',
        next_pms_schedule: toDateInput(contract.next_pms_schedule),
        branch: contract.branch || '',
        technical_specialist: contract.technical_specialist || '',
        date_of_contract: toDateInput(contract.date_of_contract),
        end_of_contract: toDateInput(contract.end_of_contract),
        status: contract.status || 'active',
        po_number: contract.po_number || '',
        service_report: contract.service_report || '',
        history: contract.history || '',
        frequency: contract.frequency || 'monthly',
        documentation: contract.documentation || '',
      })
    } else if (isOpen) {
      // Reset form for new contract
      setFormData({
        sq: '',
        end_user: '',
        model: '',
        serial: '',
        next_pms_schedule: '',
        branch: '',
        technical_specialist: '',
        date_of_contract: '',
        end_of_contract: '',
        status: 'active',
        po_number: '',
        service_report: '',
        history: '',
        frequency: 'quarterly',
        documentation: '',
      })
    }
  }, [isOpen, contract])

  const calculateNextPMS = (date: string) => {
    if (!date) return ''
    const nextPMS = new Date(date)
    nextPMS.setDate(nextPMS.getDate() + 90)
    
    return nextPMS.toISOString().slice(0, 10)
  }

  const validateForm = () => {
    const newErrors: {[key: string]: string} = {}
    
    // Validate end of contract date
    if (formData.end_of_contract) {
      const endDate = new Date(formData.end_of_contract)
      const today = new Date()
      today.setHours(0, 0, 0, 0) // Reset time to start of day
      
      if (endDate < today) {
        newErrors.end_of_contract = 'End of contract date cannot be in the past'
      }
    }
    
    // Validate date of contract vs end of contract
    if (formData.date_of_contract && formData.end_of_contract) {
      const startDate = new Date(formData.date_of_contract)
      const endDate = new Date(formData.end_of_contract)
      
      if (endDate <= startDate) {
        newErrors.end_of_contract = 'End of contract must be after the start date'
      }
    }
    
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData({ ...formData, [name]: value })
    
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors({ ...errors, [name]: '' })
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Prevent multiple submissions
    if (loading) return
    
    // Validate form before submitting
    if (!validateForm()) {
      return
    }
    
    setLoading(true)

    const formatDate = (date: string) =>
      date ? new Date(date).toISOString() : null

    // Do not send sq; backend will auto-generate
    const { sq: _omitSq, ...rest } = formData as any

    const payload = {
      ...rest,
      date_of_contract: formatDate(formData.date_of_contract),
      end_of_contract: formatDate(formData.end_of_contract),
      next_pms_schedule: formatDate(formData.next_pms_schedule),
    }

    console.log("Submitting payload:", payload)

    try {
      if (contract?.id) {
        await api.put(`/api/contracts/hardware/${contract.id}`, payload)
      } else {
        await api.post('/api/contracts/hardware', payload)
      }
      onSuccess()
      onClose()
    } catch (err: any) {
      console.error('Error saving hardware contract:', err)
      const msg = err.response?.data?.detail || 'Failed to save hardware contract'
      alert(msg)
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm overflow-y-auto h-full w-full z-50">
      <div className="relative top-2 sm:top-4 mx-auto p-3 sm:p-4 w-11/12 max-w-4xl shadow-2xl rounded-xl bg-white max-h-[95vh] overflow-y-auto">
        {/* Loading overlay */}
        {loading && (
          <div className="absolute inset-0 bg-white/90 backdrop-blur-sm flex items-center justify-center z-10 rounded-2xl">
            <div className="flex flex-col items-center space-y-3">
              <div className="animate-spin rounded-full h-10 w-10 border-4 border-blue-200 border-t-blue-600"></div>
              <div className="text-center">
                <p className="text-sm font-medium text-gray-900">Saving contract...</p>
                <p className="text-xs text-gray-500">Please wait while we process your request</p>
              </div>
            </div>
          </div>
        )}
        
        {/* Header */}
        <div className="flex items-center justify-between mb-4 pb-4 border-b border-gray-200">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center">
              <Wrench className="h-4 w-4 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">
                {contract ? 'Edit Hardware Contract' : 'Add Hardware Contract'}
              </h3>
              <p className="text-xs text-gray-600">
                {contract ? 'Update contract information' : 'Create a new hardware maintenance contract'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={loading}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Information Section */}
          <div className="space-y-4">
            <div className="flex items-center space-x-2 mb-3">
              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
              <h4 className="text-base font-semibold text-gray-900">Basic Information</h4>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* End User */}
              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-700">
                  <User className="inline h-3 w-3 mr-1" />
                  End User *
                </label>
                <input 
                  name="end_user" 
                  value={formData.end_user} 
                  onChange={handleChange} 
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-sm" 
                  placeholder="Enter company name"
                  required 
                />
              </div>

              {/* Model */}
              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-700">
                  <Wrench className="inline h-3 w-3 mr-1" />
                  Part Number *
                </label>
                <textarea 
                  name="model" 
                  value={formData.model} 
                  onChange={handleChange} 
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-sm" 
                  placeholder="Enter Part Number"
                  required 
                />
              </div>

              {/* Serial */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  <FileText className="inline h-4 w-4 mr-1" />
                  Serial Number *
                </label>
                <textarea 
                  name="serial" 
                  value={formData.serial} 
                  onChange={handleChange} 
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors" 
                  placeholder="Enter serial number"
                  required 
                />
              </div>

              {/* Next PMS Schedule - Only show when editing */}
              {contract && (
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">
                    <Calendar className="inline h-4 w-4 mr-1" />
                    Next PMS Schedule *
                  </label>
                  <input 
                    type="date" 
                    name="next_pms_schedule" 
                    value={formData.next_pms_schedule} 
                    onChange={handleChange} 
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors" 
                    required 
                  />
                </div>
              )}

              {/* Branch */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  <Building className="inline h-4 w-4 mr-1" />
                  Branch *
                </label>
                <input 
                  name="branch" 
                  value={formData.branch} 
                  onChange={handleChange} 
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors" 
                  placeholder="Enter branch location"
                  required 
                />
              </div>

              {/* Technical Specialist */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  <User className="inline h-4 w-4 mr-1" />
                  Sales
                </label>
                <input
                  type="text"
                  name="technical_specialist"
                  value={formData.technical_specialist}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  placeholder="Enter Sales Name (optional)"
                  
                />
              </div>

              {/* Date of Contract */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  <Calendar className="inline h-4 w-4 mr-1" />
                  Date of Contract *
                </label>
                <input 
                  type="date" 
                  name="date_of_contract" 
                  value={formData.date_of_contract} 
                  onChange={handleChange} 
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors" 
                  required 
                />
              </div>

              {/* End of Contract */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  <Calendar className="inline h-4 w-4 mr-1" />
                  End of Contract *
                </label>
                <input 
                  type="date" 
                  name="end_of_contract" 
                  value={formData.end_of_contract} 
                  onChange={handleChange} 
                  className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors ${
                    errors.end_of_contract ? 'border-red-500' : 'border-gray-300'
                  }`}
                  required 
                />
                {errors.end_of_contract && (
                  <p className="text-sm text-red-600 flex items-center">
                    <AlertCircle className="h-4 w-4 mr-1" />
                    {errors.end_of_contract}
                  </p>
                )}
              </div>

              {/* Status */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  <CheckCircle className="inline h-4 w-4 mr-1" />
                  Status *
                </label>
                <select 
                  name="status" 
                  value={formData.status} 
                  onChange={handleChange} 
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors" 
                  required
                >
                  <option value="active">Active</option>
                  <option value="expired">Expired</option>
                  <option value="pending">Pending</option>
                </select>
              </div>

              {/* PO Number */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  PO Number *
                </label>
                <input 
                  name="po_number" 
                  value={formData.po_number} 
                  onChange={handleChange} 
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors" 
                  placeholder="Enter PO number"
                  required
                />
              </div>
            </div>
          </div>

          {/* Additional Information Section */}
          <div className="space-y-4">
            <div className="flex items-center space-x-2 mb-3">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <h4 className="text-base font-semibold text-gray-900">Additional Information</h4>
            </div>

            {/* Service Report */}
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">
                Service Report
              </label>
              <input 
                name="service_report" 
                value={formData.service_report} 
                onChange={handleChange} 
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-sm" 
                placeholder="Enter service report details"
              />
            </div>

            {/* History */}
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">
                History
              </label>
              <textarea 
                name="history" 
                value={formData.history} 
                onChange={handleChange} 
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors min-h-[80px] text-sm" 
                placeholder="Enter maintenance history"
              />
            </div>

            {/* Frequency
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">
                Frequency *
              </label>
              <select 
                name="frequency" 
                value={formData.frequency} 
                onChange={handleChange} 
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-sm" 
                required
              >
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
                <option value="semi-annual">Semi-Annual</option>
                <option value="annual">Annual</option>
              </select>
              <p className="text-xs text-gray-500">
                Note: PMS schedule is automatically calculated by the system
              </p>
            </div> */}

            

            {/* Documentation */}
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">
                Documentation
              </label>
              <textarea 
                name="documentation" 
                value={formData.documentation} 
                onChange={handleChange} 
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors min-h-[80px] text-sm" 
                placeholder="Enter documentation details"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
            <button 
              type="button" 
              onClick={onClose} 
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={loading}
            >
              Cancel
            </button>
            <button 
              type="submit" 
              className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-indigo-600 border border-transparent rounded-md hover:from-blue-700 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 shadow-sm hover:shadow-md transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={loading}
            >
              <Save className="h-4 w-4 mr-2" />
              {loading ? 'Saving...' : (contract ? 'Update Contract' : 'Save Contract')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}