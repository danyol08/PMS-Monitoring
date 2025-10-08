export interface User {
  id: string
  email: string
  full_name: string
  role: string
  is_active: boolean
  last_login?: string
  created_at: string
  updated_at: string
}
