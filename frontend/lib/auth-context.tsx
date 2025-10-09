'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'
import api from './api'

interface User {
  id: string
  email: string
  full_name: string
  role: string
  is_active: boolean
  created_at: string
  updated_at: string
  last_login?: string
}

interface AuthContextType {
  user: User | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string, fullName: string, role?: string) => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Check for existing token
    const token = localStorage.getItem('access_token')
    if (token) {
      // Verify token and get user info
      api.get('/api/auth/me')
        .then(response => {
          setUser(response.data)
        })
        .catch(() => {
          localStorage.removeItem('access_token')
        })
        .finally(() => {
          setLoading(false)
        })
    } else {
      setLoading(false)
    }
  }, [])

  const signIn = async (email: string, password: string) => {
    const response = await api.post('/api/auth/login', { email, password })
    const { access_token, user } = response.data
    
    localStorage.setItem('access_token', access_token)
    setUser(user)
  }

  const signUp = async (email: string, password: string, fullName: string, role = 'viewer') => {
    const response = await api.post('/api/auth/signup', {
      email,
      password,
      full_name: fullName,
      role,
    })
    
    const { access_token, user } = response.data
    localStorage.setItem('access_token', access_token)
    setUser(user)
  }

  const signOut = async () => {
    try {
      await api.post('/api/auth/logout')
    } catch (e) {
      // ignore logout API errors to ensure client can still sign out
    } finally {
      localStorage.removeItem('access_token')
      setUser(null)
    }
  }

  const value = {
    user,
    loading,
    signIn,
    signUp,
    signOut,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
