'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export default function Breadcrumbs() {
  const pathname = usePathname()
  const segments = pathname.split('/').filter(Boolean)

  const crumbs = segments.map((segment, index) => {
    const href = '/' + segments.slice(0, index + 1).join('/')
    const label = segment.replace(/-/g, ' ')
    const isLast = index === segments.length - 1
    return (
      <div key={href} className="flex items-center text-sm text-gray-600">
        {index > 0 && <span className="mx-2">/</span>}
        {isLast ? (
          <span className="font-medium text-gray-900 capitalize">{label}</span>
        ) : (
          <Link href={href} className="hover:text-gray-900 capitalize">
            {label}
          </Link>
        )}
      </div>
    )
  })

  return (
    <nav aria-label="Breadcrumb" className="flex items-center flex-wrap">
      <Link href="/dashboard" className="text-sm text-gray-600 hover:text-gray-900">Dashboard</Link>
      {crumbs}
    </nav>
  )
}


