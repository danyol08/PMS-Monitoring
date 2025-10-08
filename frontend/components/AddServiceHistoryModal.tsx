'use client'

import { useState, useEffect } from 'react'
import { api } from '../lib/api'
import { X, Save, AlertCircle, Calendar, User, Building, Wrench, FileText } from 'lucide-react'

interface AddServiceHistoryModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  serviceHistory?: any
}

export default function AddServiceHistoryModal({
  isOpen,
  onClose,
  onSuccess,
  serviceHistory,
}: AddServiceHistoryModalProps) {
  const [formData, setFormData] = useState({
    contract_id: '',
    contract_type: 'hardware',
    service_date: '',
    service_type: '',
    description: '',
    technician: '',
    status: 'completed',
    service_report: '',
    company: '',
    location: '',
    model: '',
    serial: '',
    sales: '',
    sr_number: '',
  })
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<{[key: string]: string}>({})
  // No fetching of contracts; user will input contract_id manually

  // Prefill when editing
  useEffect(() => {
    if (isOpen && serviceHistory) {
      const toDateInput = (v?: string) => (v ? new Date(v).toISOString().slice(0, 10) : '')
      setFormData({
        contract_id: serviceHistory.contract_id || '',
        contract_type: serviceHistory.contract_type || 'hardware',
        service_date: toDateInput(serviceHistory.service_date),
        service_type: serviceHistory.service_type || '',
        description: serviceHistory.description || '',
        technician: serviceHistory.technician || '',
        status: serviceHistory.status || 'completed',
        service_report: serviceHistory.service_report || '',
        company: serviceHistory.company || '',
        location: serviceHistory.location || '',
        model: serviceHistory.model || '',
        serial: serviceHistory.serial || '',
        sales: serviceHistory.sales || '',
        sr_number: serviceHistory.sr_number || '',
      })
    } else if (isOpen) {
      // Reset form for new service history
      setFormData({
        contract_id: '',
        contract_type: 'hardware',
        service_date: new Date().toISOString().slice(0, 10),
        service_type: '',
        description: '',
        technician: '',
        status: 'completed',
        service_report: '',
        company: '',
        location: '',
        model: '',
        serial: '',
        sales: '',
        sr_number: '',
      })
    }
  }, [isOpen, serviceHistory])

  const validateForm = () => {
    const newErrors: {[key: string]: string} = {}
    
    if (!formData.company) {
      newErrors.company = 'Company is required'
    }
    if (!formData.service_date) {
      newErrors.service_date = 'Service date is required'
    }
    if (!formData.service_type) {
      newErrors.service_type = 'Service type is required'
    }
    if (!formData.description) {
      newErrors.description = 'Description is required'
    }
    if (!formData.technician) {
      newErrors.technician = 'Technician is required'
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

  // Contract details are entered manually now

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

    // Auto-generate contract_id since it doesn't come from contracts
    const autoId = (typeof crypto !== 'undefined' && 'randomUUID' in crypto)
      ? (crypto as any).randomUUID()
      : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
          const r = Math.random() * 16 | 0
          const v = c === 'x' ? r : (r & 0x3) | 0x8
          return v.toString(16)
        })

    const payload = {
      ...formData,
      contract_id: autoId,
      service_date: formatDate(formData.service_date),
    }

    console.log("Submitting service history:", payload)

    try {
      await api.post('/api/reports/service-history', payload)
      onSuccess()
      onClose()
    } catch (err: any) {
      console.error('Error saving service history:', err)
      const msg = err.response?.data?.detail || 'Failed to save service history'
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
                <p className="text-sm font-medium text-gray-900">Saving service history...</p>
                <p className="text-xs text-gray-500">Please wait while we process your request</p>
              </div>
            </div>
          </div>
        )}
        
        {/* Header */}
        <div className="flex items-center justify-between mb-4 pb-4 border-b border-gray-200">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-gradient-to-r from-green-600 to-emerald-600 rounded-lg flex items-center justify-center">
              <FileText className="h-4 w-4 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">
                {serviceHistory ? 'Edit Service History' : 'Add Service History'}
              </h3>
              <p className="text-xs text-gray-600">
                {serviceHistory ? 'Update service history information' : 'Create a new service history record'}
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
              <h4 className="text-base font-semibold text-gray-900">Service Information</h4>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Company */}
              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-700">
                  <Building className="inline h-3 w-3 mr-1" />
                  Company *
                </label>
                <input 
                  name="company" 
                  value={formData.company} 
                  onChange={handleChange}
                  className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-sm ${
                    errors.company ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="Enter company name"
                  required 
                />
                {errors.company && (
                  <p className="text-sm text-red-600 flex items-center">
                    <AlertCircle className="h-4 w-4 mr-1" />
                    {errors.company}
                  </p>
                )}
              </div>

              {/* Contract Type */}
              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-700">
                  Contract Type *
                </label>
                <select 
                  name="contract_type" 
                  value={formData.contract_type} 
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-sm" 
                  required 
                >
                  <option value="hardware">Hardware</option>
                  <option value="label">Label</option>
                </select>
              </div>

              {/* Service Date */}
              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-700">
                  <Calendar className="inline h-3 w-3 mr-1" />
                  Service Date *
                </label>
                <input 
                  type="date" 
                  name="service_date" 
                  value={formData.service_date} 
                  onChange={handleChange} 
                  className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-sm ${
                    errors.service_date ? 'border-red-500' : 'border-gray-300'
                  }`}
                  required 
                />
                {errors.service_date && (
                  <p className="text-sm text-red-600 flex items-center">
                    <AlertCircle className="h-4 w-4 mr-1" />
                    {errors.service_date}
                  </p>
                )}
              </div>

              {/* Service Type */}
              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-700">
                  <Wrench className="inline h-3 w-3 mr-1" />
                  Service Type *
                </label>
                <select 
                  name="service_type" 
                  value={formData.service_type} 
                  onChange={handleChange} 
                  className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-sm ${
                    errors.service_type ? 'border-red-500' : 'border-gray-300'
                  }`}
                  required 
                >
                  <option value="">Select service type...</option>
                  <option value="PMS">PMS (Preventive Maintenance Service)</option>
                  <option value="Repair">Repair</option>
                  <option value="Installation">Installation</option>
                  <option value="Inspection">Inspection</option>
                  <option value="Calibration">Calibration</option>
                  <option value="Other">Other</option>
                </select>
                {errors.service_type && (
                  <p className="text-sm text-red-600 flex items-center">
                    <AlertCircle className="h-4 w-4 mr-1" />
                    {errors.service_type}
                  </p>
                )}
              </div>

              {/* Technician */}
              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-700">
                  <User className="inline h-3 w-3 mr-1" />
                  Technician *
                </label>
                <input 
                  name="technician" 
                  value={formData.technician} 
                  onChange={handleChange} 
                  className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-sm ${
                    errors.technician ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="Enter technician name"
                  required 
                />
                {errors.technician && (
                  <p className="text-sm text-red-600 flex items-center">
                    <AlertCircle className="h-4 w-4 mr-1" />
                    {errors.technician}
                  </p>
                )}
              </div>

              {/* Status */}
              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-700">
                  Status *
                </label>
                <select 
                  name="status" 
                  value={formData.status} 
                  onChange={handleChange} 
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-sm" 
                  required
                >
                  <option value="completed">Completed</option>
                  <option value="pending">Pending</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>

              {/* SR Number */}
              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-700">
                  Service Report Number
                </label>
                <input 
                  name="sr_number" 
                  value={formData.sr_number} 
                  onChange={handleChange} 
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-sm" 
                  placeholder="Enter SR number"
                />
              </div>
            </div>
          </div>

          {/* Description Section */}
          <div className="space-y-4">
            <div className="flex items-center space-x-2 mb-3">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <h4 className="text-base font-semibold text-gray-900">Service Details</h4>
            </div>

            {/* Description */}
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">
                Description *
              </label>
              <textarea 
                name="description" 
                value={formData.description} 
                onChange={handleChange} 
                className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors min-h-[80px] text-sm ${
                  errors.description ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="Enter service description"
                required 
              />
              {errors.description && (
                <p className="text-sm text-red-600 flex items-center">
                  <AlertCircle className="h-4 w-4 mr-1" />
                  {errors.description}
                </p>
              )}
            </div>

            {/* Service Report */}
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">
                Service Report
              </label>
              <textarea 
                name="service_report" 
                value={formData.service_report} 
                onChange={handleChange} 
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors min-h-[80px] text-sm" 
                placeholder="Enter detailed service report"
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
              className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-green-600 to-emerald-600 border border-transparent rounded-md hover:from-green-700 hover:to-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 shadow-sm hover:shadow-md transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={loading}
            >
              <Save className="h-4 w-4 mr-2" />
              {loading ? 'Saving...' : (serviceHistory ? 'Update Service History' : 'Save Service History')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
