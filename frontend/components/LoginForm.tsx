'use client'

import { useState } from 'react'
import { useAuth } from '@/lib/auth-context'
import { AlertCircle, Eye, EyeOff } from 'lucide-react'

export default function LoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const { signIn } = useAuth()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      await signIn(email, password)
    } catch (error: any) {
      console.error('Login error:', error)
      console.error('Error response:', error?.response)
      console.error('Error status:', error?.response?.status)
      console.error('Error data:', error?.response?.data)
      
      // Extract error message from response
      let errorMessage = 'Login failed. Please try again.'
      
      // Check different possible error message locations
      if (error?.response?.data?.detail) {
        errorMessage = error.response.data.detail
      } else if (error?.response?.data?.message) {
        errorMessage = error.response.data.message
      } else if (error?.message) {
        errorMessage = error.message
      }
      
      // Handle specific error cases based on status code and message content
      if (error?.response?.status === 401) {
        const detail = error.response.data?.detail || ''
        
        if (detail.includes('Email address not found') || detail.includes('not found')) {
          errorMessage = '❌ Email address not found. Please check your email and try again.'
        } else if (detail.includes('Incorrect password') || detail.includes('password')) {
          errorMessage = '❌ Incorrect password. Please check your password and try again.'
        } else if (detail.includes('deactivated') || detail.includes('inactive')) {
          errorMessage = '❌ Account is deactivated. Please contact your administrator.'
        } else {
          // Generic 401 error
          errorMessage = '❌ Invalid email or password. Please check your credentials and try again.'
        }
      } else if (error?.response?.status === 400) {
        errorMessage = '❌ Invalid request. Please check your input and try again.'
      } else if (error?.response?.status === 500) {
        errorMessage = '❌ Server error. Please try again later or contact support.'
      } else if (error?.code === 'NETWORK_ERROR' || !error?.response) {
        errorMessage = '❌ Network error. Please check your internet connection and try again.'
      }
      
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  return (
    <form className="space-y-6" onSubmit={handleSubmit}>
      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border-l-4 border-red-400 rounded-md p-4 shadow-sm">
          <div className="flex">
            <div className="flex-shrink-0">
              <AlertCircle className="h-5 w-5 text-red-400" />
            </div>
            <div className="ml-3">
              <div className="text-sm">
                <h3 className="font-medium text-red-800 mb-1">
                  Login Failed
                </h3>
                <p className="text-red-700">
                  {error}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      <div>
        <label htmlFor="email" className="block text-sm font-medium text-gray-700">
          Email address
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => {
            setEmail(e.target.value)
            setError('') // Clear error when user starts typing
          }}
          className={`input mt-1 ${error ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : ''}`}
          placeholder="Enter your email address"
        />
      </div>

      <div>
        <label htmlFor="password" className="block text-sm font-medium text-gray-700">
          Password
        </label>
        <div className="relative mt-1">
          <input
            id="password"
            name="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => {
              setPassword(e.target.value)
              setError('') // Clear error when user starts typing
            }}
            className={`input pr-20 ${error ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : ''}`}
            placeholder="Enter your password"
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute inset-y-0 right-0 px-3 flex items-center text-sm text-gray-600 hover:text-gray-800 focus:outline-none"
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>

      <div>
        <button
          type="submit"
          disabled={loading}
          className={`btn btn-primary w-full flex items-center justify-center ${
            loading ? 'opacity-75 cursor-not-allowed' : ''
          }`}
        >
          {loading ? (
            <>
              <svg className="animate-spin -ml-1 mr-3 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Signing in...
            </>
          ) : (
            'Sign in'
          )}
        </button>
      </div>

      <div className="text-center">
        <p className="text-sm text-gray-600">
          Don't have an account?{' '}
          <span className="text-primary-600 font-medium">
            Contact Barcotech Admin to create one
          </span>
        </p>
      </div>
    </form>
  )
}





