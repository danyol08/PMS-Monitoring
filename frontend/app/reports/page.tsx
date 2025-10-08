'use client'

// @ts-nocheck
import React, { useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useRouter } from 'next/navigation'
import DashboardLayout from '@/components/DashboardLayout'
import { api } from '@/lib/api'
import { Download, FileText, BarChart3, Calendar, Filter } from 'lucide-react'
import Loading from '@/components/Loading'
import { supabase } from '@/lib/supabase'
import { format } from 'date-fns'

export default function Reports() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [loadingReports, setLoadingReports] = useState(false)
  const [loadingOverview, setLoadingOverview] = useState(true)
  const [loadingUpcoming, setLoadingUpcoming] = useState(true)
  const [loadingRepairs, setLoadingRepairs] = useState(true)

  // Contracts Overview
  const [contracts, setContracts] = useState<any[]>([])
  const [overviewDays, setOverviewDays] = useState<number>(30)

  // Upcoming PMS
  const [upcoming, setUpcoming] = useState<any[]>([])
  const [upcomingMonth, setUpcomingMonth] = useState<string>(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })

  // Repairs analytics
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })
  const [repairs, setRepairs] = useState<any[]>([])

  useEffect(() => {
    if (!loading && !user) {
      router.push('/')
    }
  }, [user, loading, router])

  const generateReport = async (type: 'excel' | 'pdf', contractType?: string) => {
    setLoadingReports(true)
    try {
      const params = new URLSearchParams()
      if (contractType) params.append('contract_type', contractType)
      
      const response = await api.get(`/api/reports/export/${type}?${params.toString()}`, {
        responseType: 'blob'
      })
      
      const blob = new Blob([response.data])
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `pms_report_${type}_${new Date().toISOString().split('T')[0]}.${type === 'excel' ? 'xlsx' : 'pdf'}`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Error generating report:', error)
    } finally {
      setLoadingReports(false)
    }
  }

  // Simple CSV export helpers for current dataset views
  const downloadCsv = (filename: string, rows: string[][]) => {
    const csv = rows.map(r => r.map(v => {
      const s = v ?? ''
      if (/[",\n]/.test(s)) return '"' + String(s).replace(/"/g, '""') + '"'
      return String(s)
    }).join(','))
    .join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const exportOverview = () => {
    const header = ['SQ','Type','End User','Model/Part','Branch','Tech','Next PMS','Status']
    const rows = [header, ...contracts.map((c:any, idx:number)=> ([
      idx + 1,
      c.contract_type || (c.model ? 'hardware' : 'label'),
      c.end_user || '',
      c.model || c.part_number || '',
      c.branch || '',
      c.technical_specialist || '',
      c.next_pms_schedule ? format(new Date(c.next_pms_schedule), 'MM/dd/yyyy') : '',
      c.status || ''
    ]))]
    downloadCsv(`contracts_overview_${new Date().toISOString().slice(0,10)}.csv`, rows)
  }

  const monthMatches = (isoDate?: string, ym?: string) => {
    if (!isoDate) return false
    if (!ym || ym === 'all') return true
    try {
      const d = new Date(isoDate)
      const y = d.getFullYear()
      const m = String(d.getMonth() + 1).padStart(2, '0')
      return `${y}-${m}` === ym
    } catch {
      return false
    }
  }

  const exportUpcoming = () => {
    const header = ['Type','SQ','End User','Serial','Branch','Next PMS']
    const filteredUpcoming = upcoming.filter((u:any)=> monthMatches(u.next_pms_schedule, upcomingMonth))
    const rows = [header, ...filteredUpcoming.map((u:any, idx:number)=> ([
      u.contract_type || '',
      idx + 1,
      u.end_user || '',
      u.serial || '',
      u.branch || '',
      u.next_pms_schedule ? format(new Date(u.next_pms_schedule), 'MM/dd/yyyy') : ''
    ]))]
    downloadCsv(`upcoming_pms_${upcomingMonth}.csv`, rows)
  }

  const exportRepairs = () => {
    console.log('Export Repairs clicked')
    console.log('Repairs data:', repairs)
    console.log('Selected month:', selectedMonth)
    
    if (!repairs || repairs.length === 0) {
      alert('No repairs data to export. Please check the selected month or ensure there are completed repairs.')
      return
    }
    
    const header = ['Date Closed','Company','Model','Serial','Technician Notes']
    const rows = [header, ...repairs.map((r:any)=> ([
      r.repair_closed ? format(new Date(r.repair_closed), 'MM/dd/yyyy') : '',
      r.company_name || '',
      r.device_model || '',
      r.serial_number || '',
      (r.technician_notes || '').replace(/\n/g,' ')
    ]))]
    
    console.log('CSV rows to export:', rows)
    downloadCsv(`repairs_${selectedMonth}.csv`, rows)
  }

  // Fetch contracts overview (hardware + label)
  useEffect(() => {
    const fetchOverview = async () => {
      setLoadingOverview(true)
      try {
        const [hw, lb] = await Promise.all([
          api.get('/api/contracts/hardware'),
          api.get('/api/contracts/label')
        ])
        const hwWithType = (hw.data || []).map((contract: any) => ({ ...contract, contract_type: 'hardware' }))
        const lbWithType = (lb.data || []).map((contract: any) => ({ ...contract, contract_type: 'label' }))
        const merged = [...hwWithType, ...lbWithType]
        // Sort by SQ number in ascending order (1, 2, 3, 4...)
        merged.sort((a, b) => {
          const sqA = parseInt(a.sq) || 0
          const sqB = parseInt(b.sq) || 0
          return sqA - sqB
        })
        setContracts(merged)
      } catch (e) {
        console.error('Failed to load contracts overview', e)
        setContracts([])
      } finally {
        setLoadingOverview(false)
      }
    }
    if (user) fetchOverview()
  }, [user])

  // Fetch upcoming PMS
  useEffect(() => {
    const fetchUpcoming = async () => {
      setLoadingUpcoming(true)
      try {
        // Get upcoming contracts for a longer period (90 days) and filter by month in frontend
        const res = await api.get(`/api/contracts/upcoming?days=90`)
        setUpcoming(res.data || [])
      } catch (e) {
        console.error('Failed to load upcoming PMS', e)
        setUpcoming([])
      } finally {
        setLoadingUpcoming(false)
      }
    }
    if (user) fetchUpcoming()
  }, [user])

  // Fetch repairs analytics (completed + month filter)
  useEffect(() => {
    const fetchRepairs = async () => {
      setLoadingRepairs(true)
      try {
        // Calculate start and end of selected month
        const [year, month] = selectedMonth.split('-').map(Number)
        const monthStart = new Date(year, month - 1, 1)
        const monthEnd = new Date(year, month, 0, 23, 59, 59, 999)
        
        console.log('Fetching repairs for month:', selectedMonth)
        console.log('Date range:', monthStart.toISOString(), 'to', monthEnd.toISOString())
        
        const { data, error } = await supabase
          .from('repairs')
          .select('*')
          .eq('status', 'completed')
          .gte('created_at', monthStart.toISOString())
          .lte('created_at', monthEnd.toISOString())
          .order('created_at', { ascending: true })
        
        console.log('Supabase query result:', { data, error })
        
        if (error) throw error
        setRepairs(data || [])
        console.log('Set repairs data:', data || [])
      } catch (e) {
        console.error('Failed to load repairs analytics', e)
        setRepairs([])
      } finally {
        setLoadingRepairs(false)
      }
    }
    if (user) fetchRepairs()
  }, [user, selectedMonth])

  // KPIs (contracts)
  const overviewKPIs = useMemo(() => {
    const total = contracts.length
    const active = contracts.filter(c => (c.status || '').toLowerCase() === 'active').length
    const expired = contracts.filter(c => (c.status || '').toLowerCase() === 'expired').length
    const upcoming = contracts.filter(c => c.next_pms_schedule && new Date(c.next_pms_schedule) <= new Date(Date.now() + overviewDays*24*60*60*1000)).length
    return { total, active, expired, upcoming }
  }, [contracts, overviewDays])

  // KPIs (repairs)
  const repairsKPIs = useMemo(() => {
    const total = repairs.length
    if (total === 0) return { total: 0, avgDays: 0 }
    let daysSum = 0
    repairs.forEach(r => {
      const start = r.date_received ? new Date(r.date_received) : null
      const end = r.repair_closed ? new Date(r.repair_closed) : null
      if (start && end) daysSum += Math.max(0, (end.getTime() - start.getTime()) / (1000*60*60*24))
    })
    return {
      total,
      avgDays: +(daysSum / total).toFixed(1)
    }
  }, [repairs])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loading label="Loading reports..." />
      </div>
    )
  }

  if (!user) {
    return null
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
          <p className="text-gray-600">Generate and download maintenance reports</p>
        </div>

        {/* Contracts Overview */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-gray-900">Contracts Overview</h3>
            <div className="flex items-center gap-2 text-sm">
              <button 
                className="group relative inline-flex items-center justify-center px-4 py-2 text-sm font-semibold text-white bg-gradient-to-r from-emerald-600 to-green-600 border border-transparent rounded-lg hover:from-emerald-700 hover:to-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 shadow-md hover:shadow-lg transition-all duration-200 transform hover:scale-105"
                onClick={exportOverview}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-emerald-600 to-green-600 rounded-lg opacity-0 group-hover:opacity-20 transition-opacity duration-200"></div>
                <Download className="h-4 w-4 mr-2 group-hover:-translate-y-0.5 transition-transform duration-200" />
                <span className="relative z-10">Export CSV</span>
              </button>
              <span>Upcoming window:</span>
              <input type="number" min={1} className="input w-24" value={overviewDays} onChange={e=>setOverviewDays(Number(e.target.value)||30)} />
              <span>days</span>
            </div>
          </div>
          {loadingOverview ? (
            <Loading label="Loading overview..." />
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-4">
              <div className="p-4 rounded-lg bg-gray-50"><div className="text-xs text-gray-500">Total</div><div className="text-2xl font-semibold">{overviewKPIs.total}</div></div>
              <div className="p-4 rounded-lg bg-green-50"><div className="text-xs text-green-700">Active</div><div className="text-2xl font-semibold text-green-700">{overviewKPIs.active}</div></div>
              <div className="p-4 rounded-lg bg-red-50"><div className="text-xs text-red-700">Expired</div><div className="text-2xl font-semibold text-red-700">{overviewKPIs.expired}</div></div>
              <div className="p-4 rounded-lg bg-yellow-50"><div className="text-xs text-yellow-700">Upcoming ({overviewDays}d)</div><div className="text-2xl font-semibold text-yellow-700">{overviewKPIs.upcoming}</div></div>
            </div>
          )}
          <div className="overflow-x-auto text-sm">
            <table className="min-w-full">
              <thead className="bg-gray-50"><tr><th className="px-3 py-2 text-left">SQ</th><th className="px-3 py-2 text-left">Type</th><th className="px-3 py-2 text-left">End User</th><th className="px-3 py-2 text-left">Model/Part</th><th className="px-3 py-2 text-left">Branch</th><th className="px-3 py-2 text-left">Technical Specialist</th><th className="px-3 py-2 text-left">Next PMS</th><th className="px-3 py-2 text-left">Status</th></tr></thead>
              <tbody>
                {(contracts || []).slice(0, 10).map((c:any, idx:number)=> (
                  <tr key={c.id || idx} className="border-b">
                    <td className="px-3 py-2 font-medium">{idx + 1}</td>
                    <td className="px-3 py-2">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                        c.contract_type === 'hardware' 
                          ? 'bg-blue-100 text-blue-800' 
                          : c.contract_type === 'label'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {c.contract_type || (c.model ? 'hardware' : 'label')}
                      </span>
                    </td>
                    <td className="px-3 py-2">{c.end_user}</td>
                    <td className="px-3 py-2">{c.model || c.part_number}</td>
                    <td className="px-3 py-2">{c.branch}</td>
                    <td className="px-3 py-2">{c.technical_specialist}</td>
                    <td className="px-3 py-2">{c.next_pms_schedule ? format(new Date(c.next_pms_schedule), 'dd-MMM-yy') : '—'}</td>
                    <td className="px-3 py-2">{c.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Upcoming PMS */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-gray-900">Upcoming PMS</h3>
            <div className="flex items-center gap-2 text-sm">
              <button 
                className="group relative inline-flex items-center justify-center px-4 py-2 text-sm font-semibold text-white bg-gradient-to-r from-emerald-600 to-green-600 border border-transparent rounded-lg hover:from-emerald-700 hover:to-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 shadow-md hover:shadow-lg transition-all duration-200 transform hover:scale-105"
                onClick={exportUpcoming}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-emerald-600 to-green-600 rounded-lg opacity-0 group-hover:opacity-20 transition-opacity duration-200"></div>
                <Download className="h-4 w-4 mr-2 group-hover:-translate-y-0.5 transition-transform duration-200" />
                <span className="relative z-10">Export CSV</span>
              </button>
              <span>Month:</span>
              <input 
                type="month" 
                className="input" 
                value={upcomingMonth} 
                onChange={e => setUpcomingMonth(e.target.value)} 
              />
            </div>
          </div>
          {loadingUpcoming ? (
            <Loading label="Loading upcoming PMS..." />
          ) : (
            <div className="overflow-x-auto text-sm">
              <table className="min-w-full">
                <thead className="bg-gray-50"><tr><th className="px-3 py-2 text-left">Type</th><th className="px-3 py-2 text-left">End User</th><th className="px-3 py-2 text-left">Serial</th><th className="px-3 py-2 text-left">Branch</th><th className="px-3 py-2 text-left">Next PMS</th></tr></thead>
                <tbody>
                  {(upcoming || []).filter((u:any)=> monthMatches(u.next_pms_schedule, upcomingMonth)).map((u:any, idx:number)=> (
                    <tr key={u.id || idx} className="border-b">
                      <td className="px-3 py-2">{u.contract_type}</td>
                      <td className="px-3 py-2">{u.end_user}</td>
                      <td className="px-3 py-2">{u.serial}</td>
                      <td className="px-3 py-2">{u.branch || '—'}</td>
                      <td className="px-3 py-2">{u.next_pms_schedule ? format(new Date(u.next_pms_schedule), 'dd-MMM-yy') : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {/* Footer label with count */}
          {!loadingUpcoming && (
            <div className="mt-3 text-sm text-gray-600">
              Upcoming PMS: <span className="font-semibold">{(upcoming || []).filter((u:any)=> monthMatches(u.next_pms_schedule, upcomingMonth)).length}</span>
            </div>
          )}
        </div>

        {/* Repairs Analytics */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-gray-900">Repairs Analytics</h3>
            <div className="flex items-center gap-2 text-sm">
              <button 
                className="group relative inline-flex items-center justify-center px-4 py-2 text-sm font-semibold text-white bg-gradient-to-r from-emerald-600 to-green-600 border border-transparent rounded-lg hover:from-emerald-700 hover:to-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 shadow-md hover:shadow-lg transition-all duration-200 transform hover:scale-105"
                onClick={exportRepairs}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-emerald-600 to-green-600 rounded-lg opacity-0 group-hover:opacity-20 transition-opacity duration-200"></div>
                <Download className="h-4 w-4 mr-2 group-hover:-translate-y-0.5 transition-transform duration-200" />
                <span className="relative z-10">Export CSV</span>
              </button>
              <span>Month:</span>
              <input 
                type="month" 
                className="input" 
                value={selectedMonth} 
                onChange={e => setSelectedMonth(e.target.value)} 
              />
            </div>
          </div>
          {loadingRepairs ? (
            <Loading label="Loading repairs analytics..." />
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                <div className="p-4 rounded-lg bg-gray-50"><div className="text-xs text-gray-500">Completed</div><div className="text-2xl font-semibold">{repairsKPIs.total}</div></div>
                <div className="p-4 rounded-lg bg-blue-50"><div className="text-xs text-blue-700">Avg Days to Close</div><div className="text-2xl font-semibold text-blue-700">{repairsKPIs.avgDays}</div></div>
              </div>
              <div className="overflow-x-auto text-sm">
                <table className="min-w-full">
                  <thead className="bg-gray-50"><tr><th className="px-3 py-2 text-left">Date Closed</th><th className="px-3 py-2 text-left">Company</th><th className="px-3 py-2 text-left">Model</th><th className="px-3 py-2 text-left">Serial</th><th className="px-3 py-2 text-left">Technician Notes</th></tr></thead>
                  <tbody>
                    {(repairs || []).slice(0, 15).map((r:any, idx:number)=> (
                      <tr key={r.id || idx} className="border-b">
                        <td className="px-3 py-2">{r.repair_closed ? format(new Date(r.repair_closed), 'dd-MMM-yy') : '—'}</td>
                        <td className="px-3 py-2">{r.company_name}</td>
                        <td className="px-3 py-2">{r.device_model}</td>
                        <td className="px-3 py-2">{r.serial_number}</td>
                        <td className="px-3 py-2">{r.technician_notes || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>



        
      </div>
    </DashboardLayout>
  )
}

