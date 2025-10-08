export enum RepairStatus {
  RECEIVED = 'received',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  PENDING_PARTS = 'pending_parts'
}

export interface Repair {
  id: string
  sq: string
  date_received: string
  company_name: string
  device_model: string
  part_number: string
  serial_number: string
  status: RepairStatus
  rma_case?: string
  repair_open?: string
  repair_closed?: string
  description?: string
  technician_notes?: string
  created_at: string
  updated_at: string
  created_by: string
}

export interface RepairCreate {
  sq: string
  date_received: string
  company_name: string
  device_model: string
  part_number: string
  serial_number: string
  status: RepairStatus
  rma_case?: string
  repair_open?: string
  repair_closed?: string
  description?: string
  technician_notes?: string
}

export interface RepairUpdate {
  sq?: string
  date_received?: string
  company_name?: string
  device_model?: string
  part_number?: string
  serial_number?: string
  status?: RepairStatus
  rma_case?: string
  repair_open?: string
  repair_closed?: string
  description?: string
  technician_notes?: string
}

// Repair History interface - completed repairs without cost information
export interface RepairHistory {
  id: string
  sq: string
  date_received: string
  repair_closed: string
  company_name: string
  device_model: string
  part_number: string
  serial_number: string
  rma_case?: string
  technician: string
  action_taken: string
  completion_notes?: string
  description?: string
  created_at: string
  created_by: string
}
