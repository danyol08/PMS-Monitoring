'use client'

import { useState, useEffect } from 'react'
import {
  PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend
} from 'recharts'
import { api } from '@/lib/api'

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6']

interface ChartSummary {
  hardware?: {
    by_status?: Record<string, number>
    by_branch?: Record<string, number>
    by_frequency?: Record<string, number>
  }
  label?: {
    by_status?: Record<string, number>
  }
}

export default function ContractsChart() {
  const [chartData, setChartData] = useState<ChartSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [branchStackedData, setBranchStackedData] = useState<Array<{ name: string; hardware: number; label: number }>>([])
  const [showHardware, setShowHardware] = useState(true)
  const [showLabel, setShowLabel] = useState(true)

  useEffect(() => {
    fetchChartData()
  }, [])

  const fetchChartData = async () => {
    try {
      const [summaryRes, hwRes, lbRes] = await Promise.all([
        api.get('/api/reports/contracts/summary'),
        api.get('/api/contracts/hardware'),
        api.get('/api/contracts/label')
      ])
      setChartData(summaryRes.data)

      const branchMap: Record<string, { hardware: number; label: number }> = {}
      const add = (branch: any, key: 'hardware' | 'label') => {
        const name = (branch || 'Unknown').toString().trim() || 'Unknown'
        if (!branchMap[name]) branchMap[name] = { hardware: 0, label: 0 }
        branchMap[name][key] += 1
      }
      ;(hwRes.data || []).forEach((c: any) => add(c.branch, 'hardware'))
      ;(lbRes.data || []).forEach((c: any) => add(c.branch, 'label'))
      const stacked = Object.entries(branchMap)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([name, v]) => ({ name, hardware: v.hardware, label: v.label }))
      setBranchStackedData(stacked)
    } catch (error) {
      console.error('Error fetching chart data:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-r from-purple-100 to-pink-100 rounded-xl flex items-center justify-center">
              <svg className="h-5 w-5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Contract Distribution</h3>
              <p className="text-sm text-gray-500">Analytics and insights</p>
            </div>
          </div>
        </div>
        <div className="animate-pulse">
          <div className="h-64 bg-gray-200 rounded-xl"></div>
        </div>
      </div>
    )
  }

  if (!chartData) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-r from-purple-100 to-pink-100 rounded-xl flex items-center justify-center">
              <svg className="h-5 w-5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Contract Distribution</h3>
              <p className="text-sm text-gray-500">Analytics and insights</p>
            </div>
          </div>
        </div>
        <div className="text-center py-12">
          <div className="w-16 h-16 bg-gradient-to-r from-gray-100 to-gray-200 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg className="h-8 w-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No data available</h3>
          <p className="text-gray-500">Contract distribution data will appear here once contracts are added.</p>
        </div>
      </div>
    )
  }

  // Build chart datasets safely
  const statusData: { name: string; value: number }[] = []
  const branchData: { name: string; value: number }[] = []
  const frequencyData: { name: string; value: number }[] = []

  // Process hardware data
  if (chartData.hardware) {
    if (chartData.hardware.by_status) {
      Object.entries(chartData.hardware.by_status).forEach(([status, count]) => {
        statusData.push({ name: `Hardware ${status}`, value: count })
      })
    }
    if (chartData.hardware.by_branch) {
      Object.entries(chartData.hardware.by_branch).forEach(([branch, count]) => {
        branchData.push({ name: branch, value: count })
      })
    }
    // Removed 'By Frequency' chart per request
  }

  // Process label data
  if (chartData.label?.by_status) {
    Object.entries(chartData.label.by_status).forEach(([status, count]) => {
      statusData.push({ name: `Label ${status}`, value: count })
    })
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gradient-to-r from-purple-100 to-pink-100 rounded-xl flex items-center justify-center">
            <svg className="h-5 w-5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Contract Distribution</h3>
            <p className="text-sm text-gray-500">Analytics and insights</p>
          </div>
        </div>
      </div>
      
      <div className="space-y-8">
        {/* Status Distribution */}
        {statusData.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
              <h4 className="text-sm font-semibold text-gray-700">By Status</h4>
            </div>
            <div className="bg-gray-50 rounded-xl p-4">
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={statusData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius="80%"
                    dataKey="value"
                  >
                    {statusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{
                      backgroundColor: 'white',
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                      boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                    }}
                  />
                  <Legend verticalAlign="bottom" height={36} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Branch Distribution: Hardware vs Label per branch */}
        {branchStackedData.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <h4 className="text-sm font-semibold text-gray-700">By Branch</h4>
              <div className="ml-auto flex items-center gap-3 text-xs">
                <label className="inline-flex items-center gap-1">
                  <input type="checkbox" className="rounded border-gray-300" checked={showHardware} onChange={(e)=>setShowHardware(e.target.checked)} />
                  <span className="text-gray-700">Hardware</span>
                </label>
                <label className="inline-flex items-center gap-1">
                  <input type="checkbox" className="rounded border-gray-300" checked={showLabel} onChange={(e)=>setShowLabel(e.target.checked)} />
                  <span className="text-gray-700">Label</span>
                </label>
              </div>
            </div>
            <div className="bg-gray-50 rounded-xl p-4">
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={branchStackedData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="name" stroke="#6b7280" fontSize={12} />
                  <YAxis stroke="#6b7280" fontSize={12} />
                  <Tooltip 
                    contentStyle={{
                      backgroundColor: 'white',
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                      boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                    }}
                  />
                  <Legend />
                  {showHardware && (
                    <Bar dataKey="hardware" name="Hardware" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                  )}
                  {showLabel && (
                    <Bar dataKey="label" name="Label" fill="#10B981" radius={[4, 4, 0, 0]} />
                  )}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Frequency Distribution removed */}
      </div>
    </div>
  )
}