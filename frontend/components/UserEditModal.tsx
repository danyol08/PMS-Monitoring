'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { api } from '../lib/api'
import { User } from '../types/user'
import { Shield, Settings, User as UserIcon, Eye, EyeOff } from 'lucide-react'

interface UserEditModalProps {
  user: User | null
  onClose: () => void
  onSave: (user: User) => void
}

export default function UserEditModal({ user, onClose, onSave }: UserEditModalProps) {
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    password: '',
    role: 'viewer',
    is_active: true,
  })
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [showPassword, setShowPassword] = useState(false)

  useEffect(() => {
    if (user) {
      setFormData({
        full_name: user.full_name,
        email: user.email,
        password: '', // Don't show existing password
        role: user.role,
        is_active: user.is_active,
      })
    }
    setErrors({})
  }, [user])

  const validateForm = () => {
    const newErrors: Record<string, string> = {}
    if (!formData.full_name) newErrors.full_name = 'Full name is required'
    if (!formData.email) newErrors.email = 'Email is required'
    if (!formData.role) newErrors.role = 'Role is required'
    
    // Password is required only for new users
    if (!user && !formData.password) {
      newErrors.password = 'Password is required for new users'
    }
    
    // Password length validation if provided
    if (formData.password && formData.password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters'
    }
    
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validateForm()) {
      return
    }

    setLoading(true)
    try {
      let result
      if (user) {
        // Update existing user
        const updateData: any = {
          full_name: formData.full_name,
          role: formData.role,
          is_active: formData.is_active,
        }
        
        // Only include password if provided
        if (formData.password) {
          updateData.password = formData.password
        }
        
        const response = await api.put(`/api/users/${user.id}`, updateData)
        result = [response.data]
      } else {
        // Create new user
        const response = await api.post('/api/users', {
          full_name: formData.full_name,
          email: formData.email,
          password: formData.password,
          role: formData.role,
          is_active: formData.is_active,
        })
        result = [response.data]
      }

      if (result && result.length > 0) {
        onSave(result[0] as User)
      }
    } catch (error: any) {
      console.error('Error saving user:', error)
      const errorMessage = error.response?.data?.detail || `Failed to ${user ? 'update' : 'create'} user.`
      alert(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: ''
      }))
    }
  }

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'admin':
        return <Shield className="h-4 w-4" />
      case 'technician':
        return <Settings className="h-4 w-4" />
      default:
        return <UserIcon className="h-4 w-4" />
    }
  }

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-4 sm:top-20 mx-auto p-4 sm:p-5 border w-11/12 md:w-3/4 lg:w-1/2 shadow-lg rounded-md bg-white">
        <div className="mt-3">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-semibold text-gray-900">
              {user ? 'Edit User' : 'Add New User'}
            </h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 gap-4">
              {/* Full Name */}
              <div>
                <label htmlFor="full_name" className="block text-sm font-medium text-gray-700">
                  Full Name *
                </label>
                <input
                  type="text"
                  id="full_name"
                  value={formData.full_name}
                  onChange={(e) => handleInputChange('full_name', e.target.value)}
                  className={`input ${errors.full_name ? 'border-red-300' : ''}`}
                  required
                />
                {errors.full_name && <p className="mt-1 text-sm text-red-600">{errors.full_name}</p>}
              </div>

              {/* Email */}
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                  Email *
                </label>
                <input
                  type="email"
                  id="email"
                  value={formData.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  className={`input ${errors.email ? 'border-red-300' : ''}`}
                  required
                />
                {errors.email && <p className="mt-1 text-sm text-red-600">{errors.email}</p>}
              </div>

              {/* Password */}
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                  Password {!user && '*'}
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    id="password"
                    value={formData.password}
                    onChange={(e) => handleInputChange('password', e.target.value)}
                    className={`input pr-10 ${errors.password ? 'border-red-300' : ''}`}
                    placeholder={user ? "Leave blank to keep current password" : "Enter password"}
                    required={!user}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
                {errors.password && <p className="mt-1 text-sm text-red-600">{errors.password}</p>}
                {user && (
                  <p className="mt-1 text-xs text-gray-500">
                    Leave blank to keep current password
                  </p>
                )}
                {!user && formData.password && (
                  <div className="mt-1">
                    <div className="flex space-x-1">
                      <div className={`h-1 w-1/4 rounded ${formData.password.length >= 6 ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                      <div className={`h-1 w-1/4 rounded ${formData.password.length >= 8 ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                      <div className={`h-1 w-1/4 rounded ${formData.password.length >= 10 ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                      <div className={`h-1 w-1/4 rounded ${formData.password.length >= 12 ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Password strength: {formData.password.length < 6 ? 'Weak' : formData.password.length < 8 ? 'Fair' : formData.password.length < 10 ? 'Good' : 'Strong'}
                    </p>
                  </div>
                )}
              </div>

              {/* Role */}
              <div>
                <label htmlFor="role" className="block text-sm font-medium text-gray-700">
                  Role *
                </label>
                <select
                  id="role"
                  value={formData.role}
                  onChange={(e) => handleInputChange('role', e.target.value)}
                  className={`input ${errors.role ? 'border-red-300' : ''}`}
                  required
                >
                  <option value="viewer">Viewer</option>
                  <option value="technician">Technician</option>
                  <option value="admin">Admin</option>
                </select>
                {errors.role && <p className="mt-1 text-sm text-red-600">{errors.role}</p>}
              </div>

              {/* Status */}
              <div>
                <label htmlFor="is_active" className="block text-sm font-medium text-gray-700">
                  Status
                </label>
                <select
                  id="is_active"
                  value={formData.is_active.toString()}
                  onChange={(e) => handleInputChange('is_active', e.target.value === 'true')}
                  className="input"
                >
                  <option value="true">Active</option>
                  <option value="false">Inactive</option>
                </select>
              </div>
            </div>

            {/* Form Actions */}
            <div className="flex justify-end space-x-3 pt-6 border-t border-gray-200">
              <button
                type="button"
                onClick={onClose}
                className="btn btn-secondary"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="btn btn-primary disabled:opacity-50"
              >
                {loading ? 'Saving...' : (user ? 'Save Changes' : 'Create User')}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
