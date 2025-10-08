'use client'

import { useAuth } from '@/lib/auth-context'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import DashboardLayout from '@/components/DashboardLayout'
import StatsCards from '@/components/StatsCards'
import UpcomingMaintenance from '@/components/UpcomingMaintenance'
import ContractsChart from '@/components/ContractsChart'
import { api } from '@/lib/api'
import { supabase } from '@/lib/supabase'
import { Calendar, X, Bell } from 'lucide-react'
import Loading from '@/components/Loading'
import { eventBus, EVENTS } from '@/lib/event-bus'

interface DashboardStats {
  total_contracts: number
  active_contracts: number
  expired_contracts: number
  upcoming_maintenance: number
  completed_maintenance: number
  pending_maintenance: number
}

export default function Dashboard() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loadingStats, setLoadingStats] = useState(true)
  const [quarterly, setQuarterly] = useState<any>(null)
  const [showQuarterly, setShowQuarterly] = useState(false)

  useEffect(() => {
    if (!loading && !user) {
      router.push('/')
    }
  }, [user, loading, router])

  useEffect(() => {
    if (user) {
      fetchStats()
      fetchQuarterly()
    }
  }, [user])

  // Listen for events that should trigger dashboard refresh
  useEffect(() => {
    const handleRefresh = () => {
      fetchStats()
      fetchQuarterly()
    }

    // Subscribe to events that should refresh the dashboard
    eventBus.on(EVENTS.DASHBOARD_REFRESH, handleRefresh)
    eventBus.on(EVENTS.CONTRACT_UPDATED, handleRefresh)
    eventBus.on(EVENTS.MAINTENANCE_COMPLETED, handleRefresh)
    eventBus.on(EVENTS.REPAIR_COMPLETED, handleRefresh)
    eventBus.on(EVENTS.USER_UPDATED, handleRefresh)

    // Cleanup subscriptions
    return () => {
      eventBus.off(EVENTS.DASHBOARD_REFRESH, handleRefresh)
      eventBus.off(EVENTS.CONTRACT_UPDATED, handleRefresh)
      eventBus.off(EVENTS.MAINTENANCE_COMPLETED, handleRefresh)
      eventBus.off(EVENTS.REPAIR_COMPLETED, handleRefresh)
      eventBus.off(EVENTS.USER_UPDATED, handleRefresh)
    }
  }, [])

  // Also trigger notifications every time quarterly data is loaded
  useEffect(() => {
    if (quarterly && quarterly.total_due > 0) {
      // Show notifications popup every time dashboard is visited and has notifications
      setTimeout(() => {
        setShowQuarterly(true)
      }, 500)
    }
  }, [quarterly]) // Runs whenever quarterly data changes

  const fetchStats = async () => {
    try {
      const response = await api.get('/api/contracts/dashboard/stats')
      let statsData = response.data

      // Fetch pending repairs count (exclude completed and cancelled)
      try {
        const { count } = await supabase
          .from('repairs')
          .select('id', { count: 'exact', head: true })
          .not('status', 'in', '(completed,cancelled)')

        statsData = { ...statsData, pending_maintenance: count || 0 }
      } catch (e) {
        // If counting fails, keep original value
        console.error('Error counting pending repairs:', e)
      }

      setStats(statsData)
    } catch (error) {
      console.error('Error fetching stats:', error)
    } finally {
      setLoadingStats(false)
    }
  }

  const fetchQuarterly = async () => {
    try {
      // Always fetch notifications on dashboard load
      const response = await api.get('/api/contracts/notifications/quarterly')
      setQuarterly(response.data)
    } catch (error) {
      console.error('Error fetching quarterly notifications:', error)
    }
  }

  const showQuarterlyNow = async () => {
    try {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('quarterly_popup_dismissed')
        localStorage.removeItem('quarterly_popup_snooze_until')
      }
      if (!quarterly) {
        await fetchQuarterly()
      }
      setShowQuarterly(true)
    } catch (e) {
      console.error('Unable to show quarterly notification:', e)
    }
  }

  if (loading || loadingStats) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loading label="Loading dashboard..." fullscreen={false} />
      </div>
    )
  }

  if (!user) {
    return null
  }

  return (
    <DashboardLayout>
      <div className="space-y-4 sm:space-y-6">
        {showQuarterly && quarterly && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl mx-auto transform transition-all duration-300 scale-100">
              <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-t-2xl p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-white/20 rounded-lg">
                      <Calendar className="h-6 w-6" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold">Maintenance Notifications</h3>
                      <p className="text-blue-100 text-sm">Upcoming Maintenance schedule</p>
                    </div>
                  </div>
                  <button 
                    className="p-2 hover:bg-white/20 rounded-lg transition-colors duration-200" 
                    onClick={() => setShowQuarterly(false)}
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>
              <div className="p-6 max-h-[70vh] overflow-y-auto">
                {/* Summary Card */}
                <div className={`rounded-xl p-4 mb-6 border ${
                  quarterly.overdue_count > 0 
                    ? 'bg-gradient-to-r from-red-50 to-orange-50 border-red-200' 
                    : 'bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200'
                }`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${
                        quarterly.overdue_count > 0 ? 'bg-red-100' : 'bg-blue-100'
                      }`}>
                        <Calendar className={`h-5 w-5 ${
                          quarterly.overdue_count > 0 ? 'text-red-600' : 'text-blue-600'
                        }`} />
                      </div>
                            <div>
                        <h4 className="font-semibold text-gray-900">Summary</h4>
                        <p className="text-sm text-gray-600">
                          {quarterly.overdue_count > 0 
                            ? `Overdue + upcoming maintenance (next 9 days)`
                            : 'Maintenance due in the next 9 days'
                          }
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`text-2xl font-bold ${
                        quarterly.overdue_count > 0 ? 'text-red-600' : 'text-blue-600'
                      }`}>
                        {quarterly.total_due}
                      </div>
                      <div className="text-sm text-gray-500">
                        Total Contracts
                        {quarterly.overdue_count > 0 && (
                          <span className="ml-2 text-red-600 font-medium">
                            • {quarterly.overdue_count} Overdue
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Contracts List */}
                <div className="space-y-4">
                  {Object.keys(quarterly.by_month || {}).length === 0 ? (
                    <div className="text-center py-12">
                      <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                        <Calendar className="h-8 w-8 text-green-600" />
                      </div>
                      <h3 className="text-lg font-medium text-gray-900 mb-2">All caught up!</h3>
                      <p className="text-gray-500">No maintenance due in the next 9 days.</p>
                    </div>
                  ) : (
                    Object.entries(quarterly.by_month || {}).map(([period, counts]: any) => (
                    <div key={period} className={`bg-white border rounded-xl shadow-sm hover:shadow-md transition-shadow duration-200 ${
                      period === 'Overdue' 
                        ? 'border-red-200 bg-red-50/30' 
                        : 'border-gray-200'
                    }`}>
                      <div className={`px-4 py-3 rounded-t-xl flex items-center justify-between border-b ${
                        period === 'Overdue'
                          ? 'bg-gradient-to-r from-red-50 to-red-100 border-red-200'
                          : 'bg-gradient-to-r from-gray-50 to-gray-100 border-gray-200'
                      }`}>
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${
                            period === 'Overdue' ? 'bg-red-500' : 'bg-blue-500'
                          }`}></div>
                          <span className={`font-semibold ${
                            period === 'Overdue' ? 'text-red-800' : 'text-gray-800'
                          }`}>
                            {period}
                          </span>
                        </div>
                        <div className="flex items-center gap-4 text-sm">
                          <span className={`px-2 py-1 rounded-full font-medium ${
                            period === 'Overdue'
                              ? 'bg-red-100 text-red-700'
                              : 'bg-blue-100 text-blue-700'
                          }`}>
                            Hardware: {counts.hardware}
                          </span>
                          <span className={`px-2 py-1 rounded-full font-medium ${
                            period === 'Overdue'
                              ? 'bg-red-100 text-red-700'
                              : 'bg-green-100 text-green-700'
                          }`}>
                            Label: {counts.label}
                          </span>
                          <span className={`px-2 py-1 rounded-full font-medium ${
                            period === 'Overdue'
                              ? 'bg-red-100 text-red-700'
                              : 'bg-gray-100 text-gray-700'
                          }`}>
                            Total: {counts.total}
                          </span>
                        </div>
                      </div>
                      <div className="divide-y divide-gray-100">
                        {(quarterly.items || []).filter((i: any) => {
                          if (period === 'Overdue') return i.is_overdue
                          return (i.next_pms_schedule || '').startsWith(period)
                        }).map((i: any) => (
                          <div key={i.id} className={`px-4 py-3 transition-colors duration-150 ${
                            i.is_overdue ? 'bg-red-25 hover:bg-red-50' : 'hover:bg-gray-50'
                          }`}>
                            <div className="flex items-center justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-3 mb-1">
                                  <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                                    i.contract_type === 'hardware' 
                                      ? 'bg-blue-100 text-blue-800' 
                                      : 'bg-green-100 text-green-800'
                                  }`}>
                                    {i.contract_type}
                                  </span>
                                  <span className="font-medium text-gray-900">{i.end_user}</span>
                                  {i.is_overdue && (
                                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-bold bg-red-100 text-red-800 animate-pulse">
                                      OVERDUE
                                    </span>
                                  )}
                                </div>
                                <div className="text-sm text-gray-500 flex items-center gap-4">
                                  <span>Serial: {i.serial || '—'}</span>
                                  <span>•</span>
                                  <span>PMS: {new Date(i.next_pms_schedule).toLocaleDateString()}</span>
                                  {i.days_until !== undefined && (
                                    <span className={`ml-2 font-medium ${
                                      i.days_until < 0 
                                        ? 'text-red-600' 
                                        : i.days_until <= 3 
                                        ? 'text-orange-600' 
                                        : 'text-gray-500'
                                    }`}>
                                      ({i.days_until < 0 ? `${Math.abs(i.days_until)} days overdue` : `${i.days_until} days`})
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div className="text-sm text-gray-500 font-medium">
                                {i.branch || '—'}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                    ))
                  )}
                </div>
              </div>
              <div className="px-6 py-4 bg-gray-50 rounded-b-2xl flex items-center justify-between border-t border-gray-200">
                <div className="text-sm text-gray-500">
                  Last updated: {new Date().toLocaleString()}
                </div>
                <div className="flex items-center gap-3">
                  <button 
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-200" 
                    onClick={() => { 
                      if (typeof window !== 'undefined') { 
                        localStorage.setItem('quarterly_popup_snooze_until', String(Date.now() + 1*24*60*60*1000)) 
                      } 
                      setShowQuarterly(false) 
                    }}
                  >
                    Remind me later
                  </button>
                  <button 
                    className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-blue-700 border border-transparent rounded-lg hover:from-blue-700 hover:to-blue-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-200 shadow-sm hover:shadow-md" 
                    onClick={() => { 
                      if (typeof window !== 'undefined') { 
                        localStorage.setItem('quarterly_popup_dismissed', 'true') 
                      } 
                      setShowQuarterly(false) 
                    }}
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
            <p className="text-gray-600 mt-1">Welcome back, {user.full_name || user.email}! Here's what's happening with your maintenance system.</p>
          </div>
          <button 
            className="relative inline-flex items-center px-6 py-3 border border-transparent text-sm font-medium rounded-xl text-white bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5" 
            onClick={showQuarterlyNow}
          >
            <Bell className="h-5 w-5 mr-2" />
            Notifications
            {quarterly && quarterly.total_due > 0 && (
              <span className="absolute -top-2 -right-2 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white bg-red-500 rounded-full animate-pulse">
                {quarterly.total_due}
              </span>
            )}
          </button>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="mb-8">
            <StatsCards stats={stats} />
          </div>
        )}

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <UpcomingMaintenance />
          <ContractsChart />
        </div>
      </div>
    </DashboardLayout>
  )
}
