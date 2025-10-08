'use client'

import { useState } from 'react'
import { Toaster } from 'react-hot-toast'
import { useAuth } from '../lib/auth-context'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Home,
  ClipboardList,
  Settings,
  BarChart3,
  FileText,
  Menu,
  X,
  Wrench,
  Shield,
  LogOut,
  User,
  Bell,
  Search,
  ChevronDown,
  Monitor,
  Smartphone,
  Tag,
} from 'lucide-react'

const navigation = [
  { 
    name: 'Dashboard', 
    href: '/dashboard', 
    icon: Home,
    description: 'Overview and analytics'
  },
  { 
    name: 'Hardware Contracts', 
    href: '/contracts/hardware', 
    icon: Monitor,
    description: 'Manage hardware contracts inventory'
  },
  { 
    name: 'Label Contracts', 
    href: '/contracts/label', 
    icon: Tag,
    description: 'Manage label contracts inventory'
  },
  { 
    name: 'Service History', 
    href: '/service-history', 
    icon: FileText,
    description: 'PMS records'
  },
  { 
    name: 'Repairs', 
    href: '/repairs', 
    icon: Wrench,
    description: 'Repair requests'
  },
  { 
    name: 'Repairs History', 
    href: '/repairs-history', 
    icon: FileText,
    description: 'Completed repairs'
  },
  { 
    name: 'Reports', 
    href: '/reports', 
    icon: BarChart3,
    description: 'Analytics and insights'
  },
  { 
    name: 'Audit Trail', 
    href: '/audit', 
    icon: Shield, 
    adminOnly: true,
    description: 'System activity logs'
  },
  { 
    name: 'Settings', 
    href: '/settings', 
    icon: Settings,
    description: 'System configuration'
  },
]

// comment ko to
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const { user, signOut } = useAuth()
  const pathname = usePathname()

  const handleSignOutClick = () => {
    setShowLogoutConfirm(true)
  }

  const handleConfirmLogout = async () => {
    setShowLogoutConfirm(false)
    await signOut()
    window.location.href = '/'
  }

  const handleCancelLogout = () => {
    setShowLogoutConfirm(false)
  }

  return (
    <div className="h-screen flex overflow-hidden bg-gray-50">
      <Toaster position="top-right" />
      
      {/* Mobile sidebar overlay */}
      <div className={`fixed inset-0 z-40 lg:hidden ${sidebarOpen ? 'block' : 'hidden'}`}>
        <div className="fixed inset-0 bg-gray-900/80 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
        <div className="relative flex-1 flex flex-col max-w-xs w-full bg-white shadow-xl">
          {/* Mobile sidebar header */}
          <div className="flex items-center justify-between px-4 py-4 border-b border-gray-200">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">P</span>
              </div>
              <div>
                <h1 className="text-lg font-bold text-gray-900">PMS System</h1>
                <p className="text-xs text-gray-500">Preventive Maintenance</p>
              </div>
            </div>
            <button
              onClick={() => setSidebarOpen(false)}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors active:bg-blue-100"
            >
              <X className="h-5 w-5 text-gray-500" />
            </button>
          </div>

          {/* Mobile navigation */}
          <nav className="flex-1 px-4 py-4 space-y-2">
            {navigation.map((item) => {
              // Better active state matching for nested routes
              const isActive = pathname === item.href || (
                item.href !== '/dashboard' && 
                !(item.href === '/repairs' && pathname.startsWith('/repairs-history')) && // Prevent /repairs from matching /repairs-history
                pathname.startsWith(item.href)
              )
              const canAccess = !item.adminOnly || user?.role === 'admin'
              
              if (!canAccess) return null
              
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={`group flex items-center px-3 py-3 rounded-xl transition-all duration-200
                    ${isActive
                      ? 'bg-blue-500 text-white shadow-md shadow-blue-400/20 border border-blue-400 scale-[1.01]'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 active:bg-blue-100 active:text-blue-700'}`}
                >
                  <item.icon className={`mr-3 h-5 w-5 ${isActive ? 'text-white' : 'text-gray-400 group-hover:text-gray-600 group-active:text-blue-700'}`} />
                  <div className="flex-1">
                    <div className={`font-medium ${isActive ? 'text-white' : 'text-gray-700'}`}>{item.name}</div>
                    <div className={`text-xs mt-0.5 ${isActive ? 'text-blue-50' : 'text-gray-500'}`}>{item.description}</div>
                  </div>
                </Link>
              )
            })}
          </nav>

          {/* Mobile user section */}
          <div className="border-t border-gray-200 p-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                <span className="text-white font-semibold text-sm">
                  {user?.full_name?.charAt(0) || 'U'}
                </span>
              </div>
              <div className="flex-1">
                <div className="font-medium text-gray-900">{user?.full_name || 'User'}</div>
                <div className="text-sm text-gray-500 capitalize">{user?.role || 'User'}</div>
              </div>
              <button
                onClick={handleSignOutClick}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors active:bg-blue-100"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Desktop sidebar */}
      <div className="hidden lg:flex lg:flex-shrink-0">
        <div className="flex flex-col w-60">
          <div className="flex flex-col h-0 flex-1 bg-white border-r border-gray-200 shadow-sm overflow-y-auto">
            {/* Desktop sidebar header */}
            <div className="flex items-center px-4 py-4 border-b border-gray-200">
              <div className="w-9 h-9 bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl flex items-center justify-center">
                <span className="text-white font-bold text-base">P</span>
              </div>
              <div className="ml-3">
                <h1 className="text-lg font-semibold text-gray-900">PMS Monitoring</h1>
                <p className="text-xs text-gray-500">Preventive Maintenance</p>
              </div>
            </div>

            {/* Desktop navigation */}
            <nav className="flex-1 px-3 py-4 space-y-1">
              {navigation.map((item) => {
                // Better active state matching for nested routes
                const isActive = pathname === item.href || (
                  item.href !== '/dashboard' && 
                  !(item.href === '/repairs' && pathname.startsWith('/repairs-history')) && // Prevent /repairs from matching /repairs-history
                  pathname.startsWith(item.href)
                )
                const canAccess = !item.adminOnly || user?.role === 'admin'
                
                if (!canAccess) return null
                
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={`group flex items-center px-3 py-2.5 rounded-xl transition-all duration-200
                      ${isActive
                        ? 'bg-blue-500 text-white shadow-md shadow-blue-400/20 border border-blue-400 scale-[1.01]'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 active:bg-blue-100 active:text-blue-700'}`}
                  >
                    <item.icon className={`mr-3 h-5 w-5 ${isActive ? 'text-white' : 'text-gray-400 group-hover:text-gray-600 group-active:text-blue-700'}`} />
                    <div className="flex-1">
                      <div className={`text-sm font-medium ${isActive ? 'text-white' : 'text-gray-700'}`}>{item.name}</div>
                      <div className={`text-[11px] mt-0.5 ${isActive ? 'text-blue-50' : 'text-gray-500'}`}>{item.description}</div>
                    </div>
                  </Link>
                )
              })}
            </nav>

            {/* Desktop user section */}
            <div className="border-t border-gray-200 p-3">
              <div className="flex items-center space-x-3">
                <div className="w-9 h-9 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                  <span className="text-white font-semibold text-xs">
                    {user?.full_name?.charAt(0) || 'U'}
                  </span>
                </div>
                <div className="flex-1">
                  <div className="text-sm font-medium text-gray-900 truncate">{user?.full_name || 'User'}</div>
                  <div className="text-xs text-gray-500 capitalize">{user?.role || 'User'}</div>
                </div>
                <button
                  onClick={handleSignOutClick}
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors active:bg-blue-100"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main content area */}
      <div className="flex flex-col w-0 flex-1 overflow-hidden">
        {/* Top bar */}
        <div className="lg:hidden flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 rounded-lg text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-colors active:bg-blue-100"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
              <span className="text-white font-semibold text-xs">
                {user?.full_name?.charAt(0) || 'U'}
              </span>
            </div>
          </div>
        </div>

        {/* Main content */}
        <main className="flex-1 relative overflow-y-auto">
          <div className="py-6">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              {children}
            </div>
          </div>
        </main>
      </div>

      {/* Logout confirmation modal */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm transition-opacity" />
            <div className="inline-block align-bottom bg-white rounded-2xl text-left overflow-hidden shadow-2xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <div className="bg-white px-6 pt-6 pb-4">
                <div className="flex items-center">
                  <div className="flex-shrink-0 w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                    <LogOut className="h-6 w-6 text-red-600" />
                  </div>
                  <div className="ml-4">
                    <h3 className="text-lg font-semibold text-gray-900">Sign out</h3>
                    <p className="text-sm text-gray-500 mt-1">
                      Are you sure you want to sign out? You'll need to sign in again to access your account.
                    </p>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 px-6 py-4 flex justify-end space-x-3">
                <button
                  onClick={handleCancelLogout}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 active:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmLogout}
                  className="px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-lg hover:bg-red-700 active:bg-red-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors"
                >
                  Sign out
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
