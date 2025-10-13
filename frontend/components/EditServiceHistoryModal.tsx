'use client'

import { useState, useEffect } from 'react'
import { XCircle, Save } from 'lucide-react'
import { api } from '@/lib/api'

interface EditServiceHistoryModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  service: any
}

export default function EditServiceHistoryModal({ isOpen, onClose, onSuccess, service }: EditServiceHistoryModalProps) {
  const [formData, setFormData] = useState(service || {})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (service) setFormData(service)
  }, [service])

  if (!isOpen) return null

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      await api.put(`/api/reports/service-history/${service.id}`, formData)
      onSuccess()
      onClose()
    } catch (error) {
      console.error('Error updating service:', error)
      alert('Failed to update record.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-6 border w-11/12 md:w-3/4 lg:w-1/2 shadow-lg rounded-md bg-white">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-medium text-gray-900">Edit Service Record</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <XCircle className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-gray-700">Company</label>
              <input name="company" value={formData.company || ''} onChange={handleChange} className="input" />
            </div>
            <div>
              <label className="text-sm text-gray-700">Location</label>
              <input name="location" value={formData.location || ''} onChange={handleChange} className="input" />
            </div>
            <div>
              <label className="text-sm text-gray-700">Model</label>
              <input name="model" value={formData.model || ''} onChange={handleChange} className="input" />
            </div>
            <div>
              <label className="text-sm text-gray-700">Serial</label>
              <input name="serial" value={formData.serial || ''} onChange={handleChange} className="input" />
            </div>
            <div>
              <label className="text-sm text-gray-700">Service Date</label>
              <input
                type="date"
                name="service_date"
                value={formData.service_date ? formData.service_date.split('T')[0] : ''}
                onChange={handleChange}
                className="input"
              />
            </div>
            <div>
              <label className="text-sm text-gray-700">Technician</label>
              <input name="technician" value={formData.technician || ''} onChange={handleChange} className="input" />
            </div>
            <div>
              <label className="text-sm text-gray-700">Sales</label>
              <input name="sales" value={formData.sales || ''} onChange={handleChange} className="input" />
            </div>
            <div>
              <label className="text-sm text-gray-700">SR Number</label>
              <input name="sr_number" value={formData.sr_number || ''} onChange={handleChange} className="input" />
            </div>
            <div className="col-span-2">
              <label className="text-sm text-gray-700">Service Report</label>
              <textarea
                name="service_report"
                value={formData.service_report || ''}
                onChange={handleChange}
                className="input h-24"
              />
            </div>
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm bg-gray-200 rounded hover:bg-gray-300">
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-sm text-white bg-blue-600 rounded hover:bg-blue-700 flex items-center gap-2"
            >
              <Save className="h-4 w-4" />
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
