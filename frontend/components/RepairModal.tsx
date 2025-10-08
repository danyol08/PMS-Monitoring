'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Repair, RepairCreate, RepairUpdate, RepairStatus } from '@/types/repair'

interface RepairModalProps {
  repair: Repair | null
  onClose: () => void
  onSave: (repair: Repair) => void
}

export default function RepairModal({ repair, onClose, onSave }: RepairModalProps) {
  const [formData, setFormData] = useState<RepairCreate>({
    sq: '',
    date_received: new Date().toISOString().split('T')[0],
    company_name: '',
    device_model: '',
    part_number: '',
    serial_number: '',
    status: RepairStatus.RECEIVED,
    rma_case: '',
    repair_open: '',
    description: '',
    technician_notes: ''
  })
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (repair) {
      setFormData({
        sq: repair.sq,
        date_received: repair.date_received.split('T')[0],
        company_name: repair.company_name,
        device_model: repair.device_model,
        part_number: repair.part_number,
        serial_number: repair.serial_number,
        status: repair.status,
        rma_case: repair.rma_case || '',
        repair_open: repair.repair_open ? repair.repair_open.split('T')[0] : '',
        description: repair.description || '',
        technician_notes: repair.technician_notes || ''
      })
    }
  }, [repair])

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {}

    // Removed SQ requirement; it will be auto-generated
    if (!formData.date_received) {
      newErrors.date_received = 'Date received is required'
    }
    if (!formData.company_name.trim()) {
      newErrors.company_name = 'Company name is required'
    }
    if (!formData.device_model.trim()) {
      newErrors.device_model = 'Device model is required'
    }
    if (!formData.part_number.trim()) {
      newErrors.part_number = 'Part number is required'
    }
    if (!formData.serial_number.trim()) {
      newErrors.serial_number = 'Serial number is required'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Prevent multiple submissions
    if (loading) return
    
    if (!validateForm()) {
      return
    }

    setLoading(true)
    try {
      // Auto-generate SQ for new records since we write directly via Supabase here
      let nextSq: string | undefined
      if (!repair) {
        const { data: lastRows } = await supabase
          .from('repairs')
          .select('sq, created_at')
          .order('created_at', { ascending: false })
          .limit(1)
        const lastSq = lastRows && lastRows.length > 0 ? (lastRows[0]?.sq as any) : undefined
        const lastNum = typeof lastSq === 'string' && /^\d+$/.test(lastSq) ? parseInt(lastSq, 10) : 0
        nextSq = String(lastNum + 1)
      }

      const repairData = {
        ...formData,
        // inject auto SQ only on create
        ...(nextSq ? { sq: nextSq } : {}),
        date_received: new Date(formData.date_received).toISOString(),
        repair_open: formData.repair_open ? new Date(formData.repair_open).toISOString() : null,
        repair_closed: formData.repair_closed ? new Date(formData.repair_closed).toISOString() : null
      }

      if (repair) {
        // Update existing repair
        const { data, error } = await supabase
          .from('repairs')
          .update(repairData)
          .eq('id', repair.id)
          .select()
          .single()

        if (error) {
          console.error('Error updating repair:', error)
          alert('Failed to update repair record')
          return
        }

        onSave(data)
      } else {
        // Create new repair
        const { data, error } = await supabase
          .from('repairs')
          .insert(repairData)
          .select()
          .single()

        if (error) {
          console.error('Error creating repair:', error)
          alert('Failed to create repair record')
          return
        }

        onSave(data)
      }
    } catch (error) {
      console.error('Error saving repair:', error)
      alert('Failed to save repair record')
    } finally {
      setLoading(false)
    }
  }

  const handleInputChange = (field: keyof RepairCreate, value: string | number) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
    
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: ''
      }))
    }
  }

  return (
    <div className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm overflow-y-auto h-full w-full z-50">
      <div className="relative top-2 sm:top-4 mx-auto p-3 sm:p-4 w-11/12 max-w-4xl shadow-2xl rounded-xl bg-white max-h-[95vh] overflow-y-auto">
        {/* Loading overlay */}
        {loading && (
          <div className="absolute inset-0 bg-white/90 backdrop-blur-sm flex items-center justify-center z-10 rounded-xl">
            <div className="flex flex-col items-center space-y-3">
              <div className="animate-spin rounded-full h-10 w-10 border-4 border-blue-200 border-t-blue-600"></div>
              <div className="text-center">
                <p className="text-sm font-medium text-gray-900">Saving repair record...</p>
                <p className="text-xs text-gray-500">Please wait while we process your request</p>
              </div>
            </div>
          </div>
        )}
        <div className="mt-1">
          <div className="flex items-center justify-between mb-4 pb-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">
              {repair ? 'Edit Repair Record' : 'Add New Repair Record'}
            </h3>
            <button
              onClick={onClose}
              className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={loading}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* SQ removed - auto-generated */}

              {/* Date Received */}
              <div>
                <label htmlFor="date_received" className="block text-sm font-medium text-gray-700">
                  Date Received *
                </label>
                <input
                  type="date"
                  id="date_received"
                  value={formData.date_received}
                  onChange={(e) => handleInputChange('date_received', e.target.value)}
                  className={`input py-2 text-sm ${errors.date_received ? 'border-red-300' : ''}`}
                />
                {errors.date_received && <p className="mt-1 text-sm text-red-600">{errors.date_received}</p>}
              </div>

              {/* Company Name */}
              <div>
                <label htmlFor="company_name" className="block text-sm font-medium text-gray-700">
                  Company Name *
                </label>
                <input
                  type="text"
                  id="company_name"
                  value={formData.company_name}
                  onChange={(e) => handleInputChange('company_name', e.target.value)}
                  className={`input py-2 text-sm ${errors.company_name ? 'border-red-300' : ''}`}
                />
                {errors.company_name && <p className="mt-1 text-sm text-red-600">{errors.company_name}</p>}
              </div>

              {/* Device Model */}
              <div>
                <label htmlFor="device_model" className="block text-sm font-medium text-gray-700">
                  Device Model *
                </label>
                <input
                  type="text"
                  id="device_model"
                  value={formData.device_model}
                  onChange={(e) => handleInputChange('device_model', e.target.value)}
                  className={`input py-2 text-sm ${errors.device_model ? 'border-red-300' : ''}`}
                />
                {errors.device_model && <p className="mt-1 text-sm text-red-600">{errors.device_model}</p>}
              </div>

              {/* Part Number */}
              <div>
                <label htmlFor="part_number" className="block text-sm font-medium text-gray-700">
                  Part Number *
                </label>
                <input
                  type="text"
                  id="part_number"
                  value={formData.part_number}
                  onChange={(e) => handleInputChange('part_number', e.target.value)}
                  className={`input py-2 text-sm ${errors.part_number ? 'border-red-300' : ''}`}
                />
                {errors.part_number && <p className="mt-1 text-sm text-red-600">{errors.part_number}</p>}
              </div>

              {/* Serial Number */}
              <div>
                <label htmlFor="serial_number" className="block text-sm font-medium text-gray-700">
                  Serial Number *
                </label>
                <input
                  type="text"
                  id="serial_number"
                  value={formData.serial_number}
                  onChange={(e) => handleInputChange('serial_number', e.target.value)}
                  className={`input py-2 text-sm ${errors.serial_number ? 'border-red-300' : ''}`}
                />
                {errors.serial_number && <p className="mt-1 text-sm text-red-600">{errors.serial_number}</p>}
              </div>

              {/* Status */}
              <div>
                <label htmlFor="status" className="block text-sm font-medium text-gray-700">
                  Status *
                </label>
                <select
                  id="status"
                  value={formData.status}
                  onChange={(e) => handleInputChange('status', e.target.value as RepairStatus)}
                  className="input py-2 text-sm"
                >
                  <option value={RepairStatus.RECEIVED}>Received</option>
                  <option value={RepairStatus.IN_PROGRESS}>In Progress</option>
                  <option value={RepairStatus.COMPLETED}>Completed</option>
                  <option value={RepairStatus.CANCELLED}>Cancelled</option>
                  <option value={RepairStatus.PENDING_PARTS}>Pending Parts</option>
                </select>
              </div>

              {/* RMA Case */}
              <div>
                <label htmlFor="rma_case" className="block text-sm font-medium text-gray-700">
                  RMA Case
                </label>
                <input
                  type="text"
                  id="rma_case"
                  value={formData.rma_case}
                  onChange={(e) => handleInputChange('rma_case', e.target.value)}
                  className="input py-2 text-sm"
                />
              </div>

              {/* Repair Open */}
              <div>
                <label htmlFor="repair_open" className="block text-sm font-medium text-gray-700">
                  Repair Open
                </label>
                <input
                  type="date"
                  id="repair_open"
                  value={formData.repair_open}
                  onChange={(e) => handleInputChange('repair_open', e.target.value)}
                  className="input py-2 text-sm"
                />
              </div>

              {/* Repair Closed - removed; set on completion only */}
            </div>

            {/* Description */}
            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700">
                Description
              </label>
              <textarea
                id="description"
                rows={3}
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                className="input text-sm min-h-[80px]"
              />
            </div>

            {/* Technician Notes */}
            <div>
              <label htmlFor="technician_notes" className="block text-sm font-medium text-gray-700">
                Technician Notes
              </label>
              <textarea
                id="technician_notes"
                rows={3}
                value={formData.technician_notes}
                onChange={(e) => handleInputChange('technician_notes', e.target.value)}
                className="input text-sm min-h-[80px]"
              />
            </div>

            {/* Form Actions */}
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
                {loading ? 'Saving...' : (repair ? 'Update' : 'Create')}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
