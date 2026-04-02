// src/app/lib/api.ts

const DEFAULT_BASE_URL = (
  process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8080"
).replace(/\/+$/, "");

const REQUEST_TIMEOUT_MS = 12000;

let runtimeBaseUrl = DEFAULT_BASE_URL;

if (typeof window !== "undefined") {
  const host = window.location.hostname;
  if (host === "localhost" || host === "127.0.0.1") {
    runtimeBaseUrl = "http://localhost:8080";
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const urlPath = path.startsWith("/") ? path : `/${path}`;

  const attempt = async (baseUrl: string): Promise<T> => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(`${baseUrl}${urlPath}`, {
        ...init,
        headers: {
          "Content-Type": "application/json",
          ...(init?.headers ?? {}),
        },
        cache: "no-store",
        signal: controller.signal,
      });

      if (!response.ok) {
        const bodyText = await response.text();
        try {
          const parsed = JSON.parse(bodyText) as {
            error?: string;
            message?: string;
          };
          if (parsed?.error) throw new Error(parsed.error);
          if (parsed?.message) throw new Error(parsed.message);
        } catch {}
        throw new Error(
          bodyText || `Request failed with status ${response.status}`
        );
      }

      return (await response.json()) as T;
    } catch (err: any) {
      if (err?.name === "AbortError") {
        throw new Error("Request timed out.");
      }
      throw err;
    } finally {
      clearTimeout(timeoutId);
    }
  };

  try {
    return await attempt(runtimeBaseUrl);
  } catch (err) {
    throw err;
  }
} //  FIX: properly closed function

export type PayrollEmployee = {
  id: string;
  orgId: string;
  fullName: string;
  email: string;
  phone?: string;
  title?: string;
  position?: string;
  designation?: string;
  department: string;
  salary: number;
  payCycle: "monthly" | "biweekly";
  status: "active" | "on_leave" | "terminated";
  taxId?: string;
  nssf?: string;
  nhif?: string;
  paye?: string;
  bankName?: string;
  bankAccountName?: string;
  bankAccount?: string;
  contractType?: string;
  location?: string;
  hireDate?: string;
};

export type DashboardStats = {
  totalEmployees: number;
  activeEmployees: number;
  monthlyPayroll: number;
  avgSalary: number;
};

export type TenantStats = {
  orgId: string;
  orgName: string;
  employees: number;
  monthlyPayroll: number;
};

export type AuthPayload = {
  id: string;
  name: string;
  email: string;
  role: "system_admin" | "org_admin";
  orgId?: string;
  orgName?: string;
};

export type SettingsPayload = {
  orgId: string;
  payCycle: "monthly" | "biweekly";
  currency: string;
  taxRate: number;
  pensionRate: number;
};

export type ApprovalItem = {
  id: string;
  orgId: string;
  type: "payrun" | "payslip" | "benefit";
  reference: string;
  owner: string;
  requestedOn: string;
  status: "pending" | "approved" | "rejected";
};

export type Payrun = {
  id: string;
  orgId: string;
  period: string;
  payday: string;
  netPayroll: number;
  grossPay: number;
  deductions: number;
  employees: number;
  status: "draft" | "approved" | "completed" | "processing";
};

export type Loan = {
  id: string;
  orgId: string;
  employee: string;
  amount: number;
  outstanding: number;
  nextPayment: string;
  status: "open" | "paused" | "settled";
  purpose?: string;
  tenure?: number;
  rate?: number;
};

export type Benefit = {
  id: string;
  orgId: string;
  name: string;
  amount: number;
  frequency: "Monthly" | "One-time" | "Annual";
  taxable: boolean;
  status: "active" | "paused";
  effectiveDate: string;
};

export type Payslip = {
  id: string;
  orgId: string;
  employee: string;
  email: string;
  period: string;
  gross: number;
  deductions: number;
  net: number;
  approval: "pending" | "approved" | "rejected";
};

export type LeaveType = {
  id: string;
  orgId: string;
  code: string;
  label: string;
  defaultDays: number;
  requiresDoc: boolean;
  color: string;
  accentColor: string;
  status: "active" | "inactive";
};

export type LeaveRequest = {
  id: string;
  orgId: string;
  employeeId: string;
  employeeName: string;
  department: string;
  typeCode: string;
  typeLabel: string;
  startDate: string;
  endDate: string;
  days: number;
  reason: string;
  status: "pending" | "approved" | "rejected" | "cancelled";
  appliedOn: string;
  reviewedBy?: string;
  reviewedOn?: string;
  reviewNote?: string;
};

export type ProjectIntegrationStatus = {
  baseUrl: string;
  enabled: boolean;
  connected: boolean;
  message: string;
};

export const api = {
  signup: (body: {
    name: string;
    email: string;
    password: string;
    orgName: string;
  }) =>
    request<AuthPayload>("/api/auth/signup", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  login: (body: { email: string; password: string }) =>
    request<AuthPayload>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  listEmployees: (orgId: string) =>
    request<PayrollEmployee[]>(
      `/api/employees?orgId=${encodeURIComponent(orgId)}`
    ),

  addEmployee: (body: Omit<PayrollEmployee, "id">) =>
    request<PayrollEmployee>("/api/employees", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  updateEmployee: (body: PayrollEmployee) =>
    request<PayrollEmployee>("/api/employees", {
      method: "PUT",
      body: JSON.stringify(body),
    }),

  deleteEmployee: (orgId: string, id: string) =>
    request<{ deleted: boolean }>(
      `/api/employees?orgId=${encodeURIComponent(orgId)}&id=${encodeURIComponent(id)}`,
      { method: "DELETE" }
    ),

  orgDashboard: (orgId: string) =>
    request<DashboardStats>(
      `/api/dashboard/org?orgId=${encodeURIComponent(orgId)}`
    ),

  systemDashboard: () =>
    request<{ tenants: number; employees: number; payroll: number }>(
      "/api/dashboard/system"
    ),

  tenantAnalytics: () =>
    request<TenantStats[]>("/api/analytics/tenants"),

  saveSettings: (body: SettingsPayload) =>
    request<SettingsPayload>("/api/settings", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  getSettings: (orgId: string) =>
    request<SettingsPayload>(
      `/api/settings?orgId=${encodeURIComponent(orgId)}`
    ),

  sendSupport: (body: {
    name: string;
    email: string;
    subject: string;
    message: string;
  }) =>
    request<{ sent: boolean; message: string }>("/api/support", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  sendMail: (body: { to: string[]; subject: string; html: string }) =>
    request<{ sent: boolean; message: string }>("/api/mail/send", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  listApprovals: (orgId: string) =>
    request<ApprovalItem[]>(
      `/api/approvals?orgId=${encodeURIComponent(orgId)}`
    ),

  updateApprovalStatus: (body: {
    orgId: string;
    id: string;
    status: "pending" | "approved" | "rejected";
  }) =>
    request<ApprovalItem>("/api/approvals", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  listPayruns: (orgId: string) =>
    request<Payrun[]>(
      `/api/payruns?orgId=${encodeURIComponent(orgId)}`
    ),

  createPayrun: (body: Omit<Payrun, "id">) =>
    request<Payrun>("/api/payruns", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  listLoans: (orgId: string) =>
    request<Loan[]>(`/api/loans?orgId=${encodeURIComponent(orgId)}`),

  createLoan: (body: Omit<Loan, "id">) =>
    request<Loan>("/api/loans", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  updateLoan: (body: Loan) =>
    request<Loan>("/api/loans", {
      method: "PUT",
      body: JSON.stringify(body),
    }),

  deleteLoan: (orgId: string, id: string) =>
    request<{ deleted: boolean }>(
      `/api/loans?orgId=${encodeURIComponent(orgId)}&id=${encodeURIComponent(id)}`,
      { method: "DELETE" }
    ),

  listBenefits: (orgId: string) =>
    request<Benefit[]>(
      `/api/benefits?orgId=${encodeURIComponent(orgId)}`
    ),

  createBenefit: (body: Omit<Benefit, "id">) =>
    request<Benefit>("/api/benefits", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  deleteBenefit: (orgId: string, id: string) =>
    request<{ deleted: boolean }>(
      `/api/benefits?orgId=${encodeURIComponent(orgId)}&id=${encodeURIComponent(id)}`,
      { method: "DELETE" }
    ),

  listPayslips: (orgId: string) =>
    request<Payslip[]>(
      `/api/payslips?orgId=${encodeURIComponent(orgId)}`
    ),

  createPayslip: (body: Omit<Payslip, "id">) =>
    request<Payslip>("/api/payslips", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  listLeaveTypes: (orgId: string) =>
    request<LeaveType[]>(
      `/api/leave-types?orgId=${encodeURIComponent(orgId)}`
    ),

  createLeaveType: (body: Omit<LeaveType, "id">) =>
    request<LeaveType>("/api/leave-types", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  updateLeaveType: (body: LeaveType) =>
    request<LeaveType>("/api/leave-types", {
      method: "PUT",
      body: JSON.stringify(body),
    }),

  deleteLeaveType: (orgId: string, id: string) =>
    request<{ deleted: boolean }>(
      `/api/leave-types?orgId=${encodeURIComponent(orgId)}&id=${encodeURIComponent(id)}`,
      { method: "DELETE" }
    ),

  listLeaveRequests: (orgId: string) =>
    request<LeaveRequest[]>(
      `/api/leave-requests?orgId=${encodeURIComponent(orgId)}`
    ),

  createLeaveRequest: (body: Omit<LeaveRequest, "id">) =>
    request<LeaveRequest>("/api/leave-requests", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  updateLeaveRequest: (body: LeaveRequest) =>
    request<LeaveRequest>("/api/leave-requests", {
      method: "PUT",
      body: JSON.stringify(body),
    }),

  deleteLeaveRequest: (orgId: string, id: string) =>
    request<{ deleted: boolean }>(
      `/api/leave-requests?orgId=${encodeURIComponent(orgId)}&id=${encodeURIComponent(id)}`,
      { method: "DELETE" }
    ),

  projectIntegrationStatus: () =>
    request<ProjectIntegrationStatus>("/api/integrations/project"),

  sendProjectReport: (body: {
    orgId: string;
    period: string;
    reportUrl?: string;
    summary?: string;
  }) =>
    request<{ queued: boolean; message: string }>(
      "/api/integrations/project/report",
      {
        method: "POST",
        body: JSON.stringify(body),
      }
    ),

};
