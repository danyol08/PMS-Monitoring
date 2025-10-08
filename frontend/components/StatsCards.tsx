'use client'

import { 
  ClipboardList, 
  CheckCircle, 
  XCircle, 
  Clock,
  Wrench,
  AlertTriangle
} from 'lucide-react'

interface DashboardStats {
  total_contracts: number
  active_contracts: number
  expired_contracts: number
  upcoming_maintenance: number
  completed_maintenance: number
  pending_maintenance: number
}

const stats = [
  {
    name: 'Total Contracts',
    value: 'total_contracts',
    icon: ClipboardList,
    color: 'bg-blue-500',
  },
  {
    name: 'Active Contracts',
    value: 'active_contracts',
    icon: CheckCircle,
    color: 'bg-green-500',
  },
  {
    name: 'Expired Contracts',
    value: 'expired_contracts',
    icon: XCircle,
    color: 'bg-red-500',
  },
  {
    name: 'Upcoming Maintenance',
    value: 'upcoming_maintenance',
    icon: Clock,
    color: 'bg-yellow-500',
  },
  {
    name: 'Completed Maintenance',
    value: 'completed_maintenance',
    icon: Wrench,
    color: 'bg-indigo-500',
  },
  {
    name: 'Pending Repairs',
    value: 'pending_maintenance',
    icon: AlertTriangle,
    color: 'bg-orange-500',
  },
]

export default function StatsCards({ stats: data }: { stats: DashboardStats }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6">
      {stats.map((stat) => {
        const Icon = stat.icon
        const value = data[stat.value as keyof DashboardStats]
        
        return (
          <div key={stat.name} className="group relative bg-white rounded-2xl border border-gray-200 p-6 hover:shadow-lg hover:border-gray-300 transition-all duration-300">
            <div className="flex items-center justify-between">
              <div className="flex-1 flex flex-col justify-center min-h-[60px]">
                <p className="text-sm font-medium text-gray-600 mb-1">{stat.name}</p>
                <p className="text-3xl font-bold text-gray-900 leading-none">{value}</p>
              </div>
              <div className={`h-12 w-12 rounded-2xl ${stat.color} flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform duration-300`}>
                <Icon className="h-6 w-6 text-white"/>
              </div>
            </div>
            {/* Subtle gradient overlay */}
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-transparent to-gray-50/50 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
          </div>
        )
      })}
    </div>
  )
}
