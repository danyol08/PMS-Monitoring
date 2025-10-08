'use client'

import { useState, useEffect } from 'react'
import api from '../lib/api'
import { LabelContract } from '@/types/label-contract'

interface LabelContractModalProps {
  contract: LabelContract | null
  onClose: () => void
  onSave: (contract: LabelContract) => void
}

export default function LabelContractModal({ contract, onClose, onSave }: LabelContractModalProps) {
  const [formData, setFormData] = useState({
    sq: '',
    end_user: '',
    part_number: '',
    serial: '',
    next_pms_schedule: '',
    branch: '',
    technical_specialist: '',
    date_of_contract: '',
    end_of_contract: '',
    status: 'active',
    po_number: '',
    frequency: 'monthly',
    documentation: '',
    service_report: '',
    history: '',
  })
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<{[key: string]: string}>({})


  useEffect(() => {
    if (contract) {
      setFormData({
        sq: contract.sq,
        end_user: contract.end_user,
        part_number: contract.part_number,
        serial: contract.serial,
        next_pms_schedule: contract.next_pms_schedule ? new Date(contract.next_pms_schedule).toISOString().split('T')[0] : '',
        branch: contract.branch,
        technical_specialist: contract.technical_specialist,
        date_of_contract: contract.date_of_contract ? new Date(contract.date_of_contract).toISOString().split('T')[0] : '',
        end_of_contract: contract.end_of_contract ? new Date(contract.end_of_contract).toISOString().split('T')[0] : '',
        status: contract.status,
        po_number: contract.po_number,
        frequency: contract.frequency,
        documentation: contract.documentation || '',
        service_report: contract.service_report || '',
        history: contract.history || '',
      })
    }
  }, [contract])

  const calculateNextPMS = (contractDate: string) => {
    if (!contractDate) return ''
    
    const date = new Date(contractDate)
    if (isNaN(date.getTime())) return ''
    
    // Label contracts: add 1 month (30 days)
    const nextPMS = new Date(date)
    nextPMS.setDate(nextPMS.getDate() + 30)
    
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

  const handleInputChange = (field: string, value: any) => {
    setFormData({ ...formData, [field]: value })
    
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors({ ...errors, [field]: '' })
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

    try {
      // Do not send sq; backend will auto-generate
      const { sq: _omitSq, ...rest } = formData as any
      const payload = {
        ...rest,
        date_of_contract: formData.date_of_contract ? new Date(formData.date_of_contract).toISOString() : null,
        end_of_contract: formData.end_of_contract ? new Date(formData.end_of_contract).toISOString() : null,
        next_pms_schedule: formData.next_pms_schedule ? new Date(formData.next_pms_schedule).toISOString() : null,
      }

      if (contract) {
        const { data } = await api.put(`/api/contracts/label/${contract.id}`, payload)
        onSave(data as LabelContract)
      } else {
        const { data } = await api.post('/api/contracts/label', payload)
        onSave(data as LabelContract)
      }
      // Close after successful save
      onClose()
    } catch (error: any) {
      console.error('Error saving label contract:', error)
      const msg = error?.response?.data?.detail || 'Failed to save label contract'
      alert(msg)
    } finally {
      setLoading(false)
    }
  }

  if (!contract && !formData) return null

  return (
    <div className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm overflow-y-auto h-full w-full z-50">
      <div className="relative top-2 sm:top-4 mx-auto p-3 sm:p-4 w-11/12 max-w-4xl shadow-2xl rounded-xl bg-white max-h-[95vh] overflow-y-auto">
        {/* Loading overlay */}
        {loading && (
          <div className="absolute inset-0 bg-white/90 backdrop-blur-sm flex items-center justify-center z-10 rounded-xl">
            <div className="flex flex-col items-center space-y-3">
              <div className="animate-spin rounded-full h-10 w-10 border-4 border-blue-200 border-t-blue-600"></div>
              <div className="text-center">
                <p className="text-sm font-medium text-gray-900">Saving contract...</p>
                <p className="text-xs text-gray-500">Please wait while we process your request</p>
              </div>
            </div>
          </div>
        )}
        <div className="flex items-center justify-between mb-4 pb-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">
            {contract ? 'Edit Label Contract' : 'Add Label Contract'}
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={loading}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Device Info */}
          <div>
            <h4 className="text-base font-semibold text-gray-900 mb-3">Device Info</h4>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* SQ - removed (auto) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">End User *</label>
                <input className="input py-2 text-sm" placeholder="Enter end user" value={formData.end_user} onChange={e => handleInputChange('end_user', e.target.value)} required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Part Number *</label>
                <textarea className="input py-2 text-sm" placeholder="Enter part number" value={formData.part_number} onChange={e => handleInputChange('part_number', e.target.value)} required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Serial Number *</label>
                <textarea className="input py-2 text-sm" placeholder="Enter serial number" value={formData.serial} onChange={e => handleInputChange('serial', e.target.value)} required />
              </div>
              {/* Next PMS Schedule - Only show when editing */}
              {contract && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Next PMS Schedule *</label>
                  <input type="date" className="input py-2 text-sm" value={formData.next_pms_schedule} onChange={e => handleInputChange('next_pms_schedule', e.target.value)} required />
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Branch *</label>
                <input className="input py-2 text-sm" placeholder="Enter branch" value={formData.branch} onChange={e => handleInputChange('branch', e.target.value)} required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Sales </label>
                <input 
                  type="text"
                  className="input py-2 text-sm" 
                  value={formData.technical_specialist} 
                  onChange={e => handleInputChange('technical_specialist', e.target.value)} 
                  placeholder="Enter Sales name (Optional)"
                  
                />
              </div>
            </div>
          </div>

          {/* Contract Info */}
          <div>
            <h4 className="text-base font-semibold text-gray-900 mb-3">Contract Info</h4>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div>
                <label htmlFor="date_of_contract" className="block text-sm font-medium text-gray-700 mb-1">
                  Date of Contract* <span className="text-xs text-gray-500"></span>
                </label>
                <input
                  type="date"
                  id="date_of_contract"
                  className="input py-2 text-sm"
                  value={formData.date_of_contract}
                  onChange={e => handleInputChange('date_of_contract', e.target.value)}
                  required
                />
              </div>

              <div>
                <label htmlFor="end_of_contract" className="block text-sm font-medium text-gray-700 mb-1">
                  End of Contract* <span className="text-xs text-gray-500"></span>
                </label>
                <input
                  type="date"
                  id="end_of_contract"
                  className={`input py-2 text-sm ${
                    errors.end_of_contract ? 'border-red-500' : ''
                  }`}
                  value={formData.end_of_contract}
                  onChange={e => handleInputChange('end_of_contract', e.target.value)}
                  required
                />
                {errors.end_of_contract && (
                  <p className="text-sm text-red-600 flex items-center mt-1">
                    <span className="mr-1">⚠️</span>
                    {errors.end_of_contract}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status *</label>
                <select className="input py-2 text-sm" value={formData.status} onChange={e => handleInputChange('status', e.target.value)} required>
                  <option value="active">Active</option>
                  <option value="expired">Expired</option>
                  <option value="pending">Pending</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">PO Number*</label>
                <input className="input py-2 text-sm" placeholder="Enter PO number" value={formData.po_number} onChange={e => handleInputChange('po_number', e.target.value)} required />
              </div>
              {/* <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Frequency</label>
                <select className="input py-2 text-sm" value={formData.frequency} onChange={e => handleInputChange('frequency', e.target.value)}>
                  <option value="monthly">Monthly</option>
                  <option value="quarterly">Quarterly</option>
                  <option value="semi-annual">Semi-Annual</option>
                  <option value="yearly">Yearly</option>
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  Note: PMS schedule is automatically calculated based on contract type (Hardware: every 3 months, Label: every 1 month)
                </p>
              </div> */}
            </div>
          </div>

          {/* Reports & Documentation */}
          <div>
            <h4 className="text-base font-semibold text-gray-900 mb-3">Reports & Documentation</h4>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Service Report</label>
                <input className="input min-h-[80px] text-sm" placeholder="Enter service report details" value={formData.service_report} onChange={e => handleInputChange('service_report', e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">History</label>
                <textarea className="input min-h-[80px] text-sm" placeholder="Enter maintenance history" value={formData.history} onChange={e => handleInputChange('history', e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Documentation</label>
                <textarea className="input min-h-[80px] text-sm" placeholder="Enter documentation details" value={formData.documentation} onChange={e => handleInputChange('documentation', e.target.value)} />
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
            <button 
              type="button" 
              onClick={onClose} 
              className="btn btn-secondary text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={loading}
            >
              Cancel
            </button>
            <button 
              type="submit" 
              disabled={loading} 
              className="btn btn-primary text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Saving...' : (contract ? 'Update' : 'Create')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
