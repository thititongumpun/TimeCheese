export interface Project {
  id: string
  project_no: string
  project_name: string
  is_active: boolean
  inserted_at: string
}

export interface Timesheet {
  id: string
  user_id: string
  date_memo: string
  description: string
  project_id: string | null
  inserted_at: string
  is_complete: boolean
  ai_summary: string | null
}

export interface TimesheetWithProject extends Timesheet {
  projects: { project_name: string; project_no: string } | null
}

export interface TimesheetFilters {
  date_from: string | null
  date_to: string | null
  project_id: string | null
  status: 'all' | 'complete' | 'incomplete'
}

export type ProjectInput = {
  project_no: string
  project_name: string
  is_active: boolean
}

export type TimesheetInput = {
  date_memo: string
  description: string
  project_id: string | null
  is_complete: boolean
}
