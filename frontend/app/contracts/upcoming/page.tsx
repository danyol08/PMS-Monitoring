'use client'

import { useAuth } from '@/lib/auth-context'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import DashboardLayout from '@/components/DashboardLayout'
import { api } from '@/lib/api'
import Link from 'next/link'
import { format } from 'date-fns'

interface ContractSummary {
  id: string
  sq: string
  end_user: string
  serial: string
  next_pms_schedule: string
  status: string
  contract_type: 'hardware' | 'label'
  days_until_maintenance: number
}

export default function UpcomingContractsPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [contracts, setContracts] = useState<ContractSummary[]>([])
  const [loadingContracts, setLoadingContracts] = useState(true)
  const [days, setDays] = useState(30)
  const [search, setSearch] = useState('')

  useEffect(() => {
    if (!loading && !user) {
      router.push('/')
    }
  }, [user, loading, router])

  useEffect(() => {
    if (user) {
      fetchUpcoming()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, days])

  const fetchUpcoming = async () => {
    try {
      setLoadingContracts(true)
      const response = await api.get(`/api/contracts/upcoming`, { params: { days } })
      setContracts(response.data || [])
    } catch (error) {
      console.error('Error fetching upcoming maintenance:', error)
    } finally {
      setLoadingContracts(false)
    }
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return contracts
    return contracts.filter(c =>
      c.sq.toLowerCase().includes(q) ||
      c.end_user.toLowerCase().includes(q) ||
      c.serial.toLowerCase().includes(q) ||
      c.contract_type.toLowerCase().includes(q)
    )
  }, [contracts, search])

  if (loading || loadingContracts) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Upcoming Maintenance</h1>
            <p className="text-gray-600">Loading upcoming maintenance...</p>
          </div>
          <div className="card">
            <div className="animate-pulse space-y-3">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-4 bg-gray-200 rounded"></div>
              ))}
            </div>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  if (!user) {
    return null
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Upcoming Maintenance</h1>
            <p className="text-gray-600">All scheduled maintenance due within the selected window</p>
          </div>
          <Link href="/dashboard" className="text-primary-600 hover:text-primary-500 text-sm">Back to dashboard</Link>
        </div>

        <div className="card">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <input
              type="text"
              placeholder="Search by SQ, end user, serial, type"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input w-full sm:max-w-md"
            />
            <div className="flex items-center gap-2">
              <label htmlFor="days" className="text-sm text-gray-600">Within</label>
              <select
                id="days"
                value={days}
                onChange={(e) => setDays(parseInt(e.target.value))}
                className="select"
              >
                <option value={7}>7 days</option>
                <option value={14}>14 days</option>
                <option value={30}>30 days</option>
                <option value={60}>60 days</option>
                <option value={90}>90 days</option>
              </select>
            </div>
          </div>
        </div>

        <div className="card">
          {filtered.length === 0 ? (
            <p className="text-gray-600">No upcoming maintenance found.</p>
          ) : (
            <div className="divide-y">
              {filtered.map(c => (
                <div key={c.id} className="flex items-center justify-between py-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-900 truncate">{c.sq}</span>
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                        c.contract_type === 'hardware' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'
                      }`}>
                        {c.contract_type}
                      </span>
                      <span className="text-xs text-gray-500 truncate">{c.end_user}</span>
                      <span className="text-xs text-gray-400 truncate">Serial: {c.serial}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium text-gray-900">
                      {c.next_pms_schedule ? format(new Date(c.next_pms_schedule), 'MMM dd, yyyy') : '—'}
                    </div>
                    <div className={`text-xs ${
                      c.days_until_maintenance <= 7
                        ? 'text-red-600'
                        : c.days_until_maintenance <= 14
                        ? 'text-yellow-600'
                        : 'text-gray-500'
                    }`}>
                      {c.days_until_maintenance} days
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  )
}


