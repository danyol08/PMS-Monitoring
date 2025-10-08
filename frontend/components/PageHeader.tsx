'use client'

import React from 'react'
import { usePathname } from 'next/navigation'

interface PageHeaderProps {
  title: string
  subtitle?: string
  actions?: React.ReactNode
  children?: React.ReactNode
}

export default function PageHeader({ title, subtitle, actions, children }: PageHeaderProps) {
  const pathname = usePathname()
  return (
    <div className="space-y-3 sm:space-y-4 mb-4 sm:mb-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
          {subtitle && <p className="text-gray-600 mt-1">{subtitle}</p>}
        </div>
        {actions && <div className="mt-3 sm:mt-0 flex items-center space-x-2">{actions}</div>}
      </div>
      {children}
    </div>
  )
}


