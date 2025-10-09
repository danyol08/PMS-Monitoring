'use client'

import { useAuth } from '../../lib/auth-context'
import api from '../../lib/api'
import toast from 'react-hot-toast'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import DashboardLayout from '../../components/DashboardLayout'
import EmptyState from '../../components/EmptyState'
import UserEditModal from '../../components/UserEditModal'
import ServiceHistorySetup from '../../components/ServiceHistorySetup'
import { Save, Shield, Users as UsersIcon, Plus, Search, Edit, Trash2, UserCheck, UserX, User as UserIcon, Settings as SettingsIcon, Database } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { format } from 'date-fns'
import Loading from '../../components/Loading'

export default function Settings() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialTab = searchParams?.get('tab') || 'security'
  const [activeTab, setActiveTab] = useState(initialTab)
  const [pw, setPw] = useState({ current: '', new: '', confirm: '' })
  const [usersList, setUsersList] = useState<any[]>([])
  const [loadingUsers, setLoadingUsers] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [editingUser, setEditingUser] = useState<any | null>(null)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)

  useEffect(() => {
    if (!loading && !user) {
      router.push('/')
    }
  }, [user, loading, router])

  useEffect(() => {
    const tab = searchParams?.get('tab')
    if (tab && tab !== activeTab) {
      setActiveTab(tab)
    }
  }, [searchParams])

  // Prevent non-admins from landing on the users tab via URL
  useEffect(() => {
    if (activeTab === 'users' && user?.role !== 'admin') {
      setActiveTab('security')
    }
  }, [activeTab, user])

  const handleTabChange = (tabId: string) => {
    // Coerce if not allowed
    const nextTab = tabId === 'users' && user?.role !== 'admin' ? 'security' : tabId
    setActiveTab(nextTab)
    const params = new URLSearchParams(searchParams?.toString() || '')
    params.set('tab', nextTab)
    router.replace(`/settings?${params.toString()}`)
  }

  // Load users when admin opens settings
  useEffect(() => {
    if (user?.role === 'admin') {
      fetchUsers()
    }
  }, [user])

  const fetchUsers = async () => {
    try {
      const response = await api.get('/api/users/')
      setUsersList(response.data)
    } catch (error) {
      console.error('Error fetching users:', error)
    } finally {
      setLoadingUsers(false)
    }
  }

  const filteredUsers = usersList.filter((u: any) => {
    const matchesSearch = (u.full_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (u.email || '').toLowerCase().includes(searchTerm.toLowerCase())
    const matchesRole = roleFilter === 'all' || u.role === roleFilter
    return matchesSearch && matchesRole
  })

  const handleAddUser = () => {
    setEditingUser(null)
    setIsAddModalOpen(true)
  }

  const handleEditUser = (u: any) => {
    setEditingUser(u)
    setIsEditModalOpen(true)
  }

  const handleToggleUserStatus = async (userId: string, currentStatus: boolean) => {
    if (!confirm(`Are you sure you want to ${currentStatus ? 'deactivate' : 'activate'} this user?`)) {
      return
    }
    try {
      const { error } = await supabase
        .from('users')
        .update({ is_active: !currentStatus })
        .eq('id', userId)
      if (error) {
        console.error('Error updating user status:', error)
        alert('Failed to update user status')
        return
      }
      setUsersList(usersList.map((u: any) => u.id === userId ? { ...u, is_active: !currentStatus } : u))
    } catch (error) {
      console.error('Error updating user status:', error)
      alert('Failed to update user status')
    }
  }

  const handleDeleteUser = async (userId: string) => {
    if (!confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
      return
    }
    try {
      const { error } = await supabase
        .from('users')
        .delete()
        .eq('id', userId)
      if (error) {
        console.error('Error deleting user:', error)
        alert('Failed to delete user')
        return
      }
      setUsersList(usersList.filter((u: any) => u.id !== userId))
    } catch (error) {
      console.error('Error deleting user:', error)
      alert('Failed to delete user')
    }
  }

  const handleModalClose = () => {
    setIsEditModalOpen(false)
    setIsAddModalOpen(false)
    setEditingUser(null)
  }

  const handleModalSave = (updatedUser: any) => {
    if (editingUser) {
      setUsersList(usersList.map((u: any) => u.id === updatedUser.id ? updatedUser : u))
    } else {
      setUsersList([updatedUser, ...usersList])
    }
    handleModalClose()
  }

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'admin':
        return <Shield className="h-4 w-4" />
      case 'technician':
        return <SettingsIcon className="h-4 w-4" />
      default:
        return <UserIcon className="h-4 w-4" />
    }
  }

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin':
        return 'bg-red-100 text-red-800'
      case 'technician':
        return 'bg-blue-100 text-blue-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loading label="Loading settings..." />
      </div>
    )
  }

  if (!user) {
    return null
  }

  const tabs = [
    { id: 'security', name: 'Security', icon: Shield },
    ...(user?.role === 'admin' ? [{ id: 'users', name: 'Users', icon: UsersIcon }] : []),
    ...(user?.role === 'admin' ? [{ id: 'database', name: 'Database', icon: Database }] : []),
  ]

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
          <p className="text-gray-600">Manage your account and system preferences</p>
        </div>

        <div className="flex flex-col lg:flex-row gap-4 sm:gap-6">
          {/* Sidebar */}
          <div className="lg:w-64">
            <nav className="space-y-1">
              {tabs.map((tab) => {
                const Icon = tab.icon
                return (
                  <button
                    key={tab.id}
                    onClick={() => handleTabChange(tab.id)}
                    className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-md ${
                      activeTab === tab.id
                        ? 'bg-primary-100 text-primary-900'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    }`}
                  >
                    <Icon className="h-4 w-4 mr-3" />
                    {tab.name}
                  </button>
                )
              })}
            </nav>
          </div>

          {/* Content */}
          <div className="flex-1">
            
            {activeTab === 'security' && (
              <div className="space-y-6">
                <div className="card">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Change Password</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Current Password</label>
                      <input type="password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} className="input" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">New Password</label>
                      <input type="password" value={pw.new} onChange={(e) => setPw({ ...pw, new: e.target.value })} className="input" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Confirm New Password</label>
                      <input type="password" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} className="input" />
                    </div>
                  </div>
                  <div className="mt-6">
                    <button onClick={async () => {
                      if (!pw.current || !pw.new) { toast.error('Fill all fields'); return }
                      if (pw.new !== pw.confirm) { toast.error('Passwords do not match'); return }
                      try {
                        await api.post('/api/auth/change-password', { current_password: pw.current, new_password: pw.new })
                        toast.success('Password updated')
                        setPw({ current: '', new: '', confirm: '' })
                      } catch (e: any) {
                        toast.error(e?.response?.data?.detail || 'Failed to change password')
                      }
                    }} className="btn btn-primary flex items-center">
                      <Save className="h-4 w-4 mr-2" />
                      Update Password
                    </button>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'users' && user?.role === 'admin' && (
              <div className="space-y-6">
                {loadingUsers ? (
                  <div className="min-h-[200px] flex items-center justify-center">
                    <Loading label="Loading users..." />
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-medium text-gray-900">User Management</h3>
                      <button onClick={handleAddUser} className="btn btn-primary flex items-center">
                        <Plus className="h-4 w-4 mr-2" />
                        Add User
                    </button>
                    </div>

                    <div className="bg-white p-4 rounded-lg shadow">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Search</label>
                          <div className="relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                            <input
                              type="text"
                              placeholder="Search users..."
                              value={searchTerm}
                              onChange={(e) => setSearchTerm(e.target.value)}
                              className="input pl-10"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Role</label>
                          <select
                            value={roleFilter}
                            onChange={(e) => setRoleFilter(e.target.value)}
                            className="input"
                          >
                            <option value="all">All Roles</option>
                            <option value="admin">Admin</option>
                            <option value="technician">Technician</option>
                            <option value="viewer">Viewer</option>
                          </select>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                      {filteredUsers.map((u: any) => (
                        <div key={u.id} className="bg-white shadow rounded-lg p-4 sm:p-6">
                          <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center">
                              <div className="h-10 w-10 bg-gray-200 rounded-full flex items-center justify-center">
                                <UserIcon className="h-6 w-6 text-gray-600" />
                              </div>
                              <div className="ml-3">
                                <h3 className="text-lg font-medium text-gray-900">{u.full_name}</h3>
                                <p className="text-sm text-gray-500">{u.email}</p>
                              </div>
                            </div>
                            <div className="flex items-center space-x-2">
                              <button 
                                onClick={() => handleEditUser(u)}
                                className="text-blue-600 hover:text-blue-900 p-1 rounded hover:bg-blue-50 transition-colors"
                                title="Edit user"
                              >
                                <Edit className="h-4 w-4" />
                    </button>
                              <button 
                                onClick={() => handleDeleteUser(u.id)}
                                className="text-red-600 hover:text-red-900 p-1 rounded hover:bg-red-50 transition-colors"
                                title="Delete user"
                              >
                                <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                  <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-gray-500">Role</span>
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getRoleColor(u.role)}`}>
                                {getRoleIcon(u.role)}
                                <span className="ml-1 capitalize">{u.role}</span>
                              </span>
                            </div>

                            <div className="flex items-center justify-between">
                              <span className="text-sm text-gray-500">Status</span>
                              <div className="flex items-center">
                                {u.is_active ? (
                                  <UserCheck className="h-4 w-4 text-green-500 mr-1" />
                                ) : (
                                  <UserX className="h-4 w-4 text-red-500 mr-1" />
                                )}
                                <span className={`text-sm font-medium ${u.is_active ? 'text-green-600' : 'text-red-600'}`}>
                                  {u.is_active ? 'Active' : 'Inactive'}
                                </span>
                              </div>
                            </div>

                            {u.last_login && (
                              <div className="flex items-center justify-between">
                                <span className="text-sm text-gray-500">Last Login</span>
                                <span className="text-sm text-gray-900">
                                  {format(new Date(u.last_login), 'MMM dd, yyyy')}
                                </span>
                              </div>
                            )}

                            <div className="flex items-center justify-between">
                              <span className="text-sm text-gray-500">Created</span>
                              <span className="text-sm text-gray-900">
                                {format(new Date(u.created_at), 'MMM dd, yyyy')}
                              </span>
                  </div>
                </div>

                          <div className="mt-4 pt-4 border-t border-gray-200">
                            <div className="flex space-x-2">
                              <button 
                                onClick={() => handleEditUser(u)}
                                className="btn btn-secondary text-xs flex-1 min-h-[32px] sm:min-h-[36px]"
                              >
                                Edit
                              </button>
                              <button 
                                onClick={() => handleToggleUserStatus(u.id, u.is_active)}
                                className={`btn text-xs flex-1 min-h-[32px] sm:min-h-[36px] ${
                                  u.is_active ? 'btn-danger' : 'btn-primary'
                                }`}
                              >
                                {u.is_active ? 'Deactivate' : 'Activate'}
                  </button>
                </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {filteredUsers.length === 0 && (
                      <div className="bg-white shadow rounded-lg">
                        <EmptyState title="No users found" description="Click Add User to create the first account." />
                      </div>
                    )}

                    <div className="flex items-center justify-between">
                      <div className="text-sm text-gray-700">
                        Showing {filteredUsers.length} of {usersList.length} users
                      </div>
                      <div className="flex space-x-2">
                        <button className="btn btn-secondary">Previous</button>
                        <button className="btn btn-secondary">Next</button>
                      </div>
                    </div>

                    {isEditModalOpen && (
                      <UserEditModal
                        user={editingUser}
                        onClose={handleModalClose}
                        onSave={handleModalSave}
                      />
                    )}

                    {isAddModalOpen && (
                      <UserEditModal
                        user={null}
                        onClose={handleModalClose}
                        onSave={handleModalSave}
                      />
                    )}
                  </>
                )}
              </div>
            )}

            {activeTab === 'database' && user?.role === 'admin' && (
              <div className="space-y-6">
                <ServiceHistorySetup />
              </div>
            )}

          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}