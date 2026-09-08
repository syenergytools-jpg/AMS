export type Role = "EMPLOYEE" | "ADMIN";

export type AttendanceStatus = "PRESENT" | "LATE" | "ABSENT";

export interface Profile {
  id: string;
  full_name: string;
  email: string;
  role: Role;
  cnic: string | null;
  phone: string | null;
  address: string | null;
  department: string | null;
  position: string | null;
  avatar_url: string | null;
  shift_start: string;
  shift_end: string;
  device_user_id: string | null;
  created_at: string;
}

export interface Attendance {
  id: string;
  user_id: string;
  work_date: string;
  check_in: string | null;
  check_out: string | null;
  status: AttendanceStatus;
  note: string | null;
  created_at: string;
}

export interface SalarySlip {
  id: string;
  user_id: string;
  month: string;
  basic_salary: number;
  allowances: number;
  deductions: number;
  note: string | null;
  created_at: string;
}

export type LeaveType = "SICK" | "CASUAL" | "ANNUAL" | "OTHER";
export type LeaveStatus = "PENDING" | "APPROVED" | "REJECTED";

export interface LeaveRequest {
  id: string;
  user_id: string;
  start_date: string;
  end_date: string;
  leave_type: LeaveType;
  reason: string | null;
  status: LeaveStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
}

export type NotificationType = "LEAVE_REQUESTED" | "LEAVE_APPROVED" | "LEAVE_REJECTED";

export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  message: string;
  link: string | null;
  read_at: string | null;
  created_at: string;
}
