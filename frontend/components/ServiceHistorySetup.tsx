'use client'

import { useState } from 'react'
import { api } from '../lib/api'
import { Database, CheckCircle, XCircle, AlertTriangle } from 'lucide-react'

export default function ServiceHistorySetup() {
  const [testing, setTesting] = useState(false)
  const [creating, setCreating] = useState(false)
  const [testResult, setTestResult] = useState<any>(null)
  const [createResult, setCreateResult] = useState<any>(null)

  const testServiceHistory = async () => {
    setTesting(true)
    setTestResult(null)
    
    try {
      const response = await api.get('/api/contracts/test-service-history')
      setTestResult(response.data)
    } catch (error: any) {
      setTestResult({
        status: 'error',
        error: error?.response?.data?.detail || error?.message || 'Unknown error'
      })
    } finally {
      setTesting(false)
    }
  }

  const createServiceHistoryTable = async () => {
    setCreating(true)
    setCreateResult(null)
    
    try {
      const response = await api.post('/api/contracts/create-service-history-table')
      setCreateResult(response.data)
    } catch (error: any) {
      setCreateResult({
        status: 'error',
        error: error?.response?.data?.detail || error?.message || 'Unknown error'
      })
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="bg-white p-6 rounded-lg shadow">
      <div className="flex items-center space-x-2 mb-4">
        <Database className="h-5 w-5 text-blue-600" />
        <h3 className="text-lg font-medium text-gray-900">Service History Setup</h3>
      </div>

      <div className="space-y-4">
        {/* Test Service History Table */}
        <div className="border rounded-lg p-4">
          <h4 className="font-medium text-gray-900 mb-2">Test Service History Table</h4>
          <p className="text-sm text-gray-600 mb-3">
            Check if the service_history table exists and is accessible.
          </p>
          <button
            onClick={testServiceHistory}
            disabled={testing}
            className="btn btn-primary btn-sm"
          >
            {testing ? 'Testing...' : 'Test Table'}
          </button>

          {testResult && (
            <div className={`mt-3 p-3 rounded-md ${
              testResult.status === 'success' 
                ? 'bg-green-50 border border-green-200' 
                : 'bg-red-50 border border-red-200'
            }`}>
              <div className="flex items-center space-x-2">
                {testResult.status === 'success' ? (
                  <CheckCircle className="h-4 w-4 text-green-600" />
                ) : (
                  <XCircle className="h-4 w-4 text-red-600" />
                )}
                <span className={`text-sm font-medium ${
                  testResult.status === 'success' ? 'text-green-800' : 'text-red-800'
                }`}>
                  {testResult.status === 'success' ? 'Table Accessible' : 'Table Error'}
                </span>
              </div>
              <p className="text-sm text-gray-600 mt-1">
                {testResult.message}
              </p>
              {testResult.error && (
                <p className="text-sm text-red-600 mt-1">
                  Error: {testResult.error}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Create Service History Table */}
        <div className="border rounded-lg p-4">
          <h4 className="font-medium text-gray-900 mb-2">Create Service History Table</h4>
          <p className="text-sm text-gray-600 mb-3">
            Create the service_history table if it doesn't exist.
          </p>
          <button
            onClick={createServiceHistoryTable}
            disabled={creating}
            className="btn btn-secondary btn-sm"
          >
            {creating ? 'Creating...' : 'Create Table'}
          </button>

          {createResult && (
            <div className={`mt-3 p-3 rounded-md ${
              createResult.status === 'success' 
                ? 'bg-green-50 border border-green-200' 
                : 'bg-red-50 border border-red-200'
            }`}>
              <div className="flex items-center space-x-2">
                {createResult.status === 'success' ? (
                  <CheckCircle className="h-4 w-4 text-green-600" />
                ) : (
                  <XCircle className="h-4 w-4 text-red-600" />
                )}
                <span className={`text-sm font-medium ${
                  createResult.status === 'success' ? 'text-green-800' : 'text-red-800'
                }`}>
                  {createResult.status === 'success' ? 'Table Created' : 'Creation Failed'}
                </span>
              </div>
              <p className="text-sm text-gray-600 mt-1">
                {createResult.message}
              </p>
              {createResult.error && (
                <p className="text-sm text-red-600 mt-1">
                  Error: {createResult.error}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Instructions */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-center space-x-2 mb-2">
            <AlertTriangle className="h-4 w-4 text-yellow-600" />
            <span className="text-sm font-medium text-yellow-800">Instructions</span>
          </div>
          <div className="text-sm text-yellow-700">
            <p>1. First, test if the service_history table exists</p>
            <p>2. If the test fails, create the table using the "Create Table" button</p>
            <p>3. After creating the table, test again to confirm it works</p>
            <p>4. Then try completing PMS again</p>
          </div>
        </div>
      </div>
    </div>
  )
}
