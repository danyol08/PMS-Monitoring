export interface LabelContractBase {
  sq: string;
  end_user: string;
  part_number: string;
  serial: string;
  next_pms_schedule: string; // ISO string
  branch: string;
  technical_specialist: string;
  date_of_contract: string;
  end_of_contract: string;
  status: string;
  po_number: string;
  frequency: string;
  documentation?: string;
  service_report?: string;
  history?: string;
  reports?: string;
}

export interface LabelContractCreate extends LabelContractBase {}

export interface LabelContract extends LabelContractBase {
  id: string;
  created_at: string;
  updated_at: string;
  created_by: string;
}

export interface LabelContractUpdate {
  sq?: string;
  end_user?: string;
  part_number?: string;
  serial?: string;
  next_pms_schedule?: string;
  branch?: string;
  technical_specialist?: string;
  date_of_contract?: string;
  end_of_contract?: string;
  status?: string;
  po_number?: string;
  frequency?: string;
  documentation?: string;
}
