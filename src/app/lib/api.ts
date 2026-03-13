const DEFAULT_BASE_URL = (process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8080").replace(/\/+$/, "");
const REQUEST_TIMEOUT_MS = 12000;
let runtimeBaseUrl = DEFAULT_BASE_URL;

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const urlPath = path.startsWith("/") ? path : `/${path}`;

  const attempt = async (baseUrl: string): Promise<T> => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      let response: Response;
      try {
        response = await fetch(`${baseUrl}${urlPath}`, {
          ...init,
          headers: {
            "Content-Type": "application/json",
            ...(init?.headers ?? {}),
          },
          cache: "no-store",
          signal: controller.signal,
        });
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
          throw new Error("Request timed out. Check backend availability.");
        }
        throw err;
      }

      if (!response.ok) {
        const bodyText = await response.text();
        try {
          const parsed = JSON.parse(bodyText) as { error?: string; message?: string };
          if (parsed?.error) {
            throw new Error(parsed.error);
          }
          if (parsed?.message) {
            throw new Error(parsed.message);
          }
        } catch {
          // Ignore JSON parse errors and fall back to raw text.
        }
        throw new Error(bodyText || `Request failed with status ${response.status}`);
      }

      return (await response.json()) as T;
    } finally {
      clearTimeout(timeoutId);
    }
  };

  try {
    return await attempt(runtimeBaseUrl);
  } catch (err) {
    const isLocalhost = typeof window !== "undefined" && window.location.hostname === "localhost";
    if (isLocalhost && runtimeBaseUrl !== "http://localhost:8080") {
      runtimeBaseUrl = "http://localhost:8080";
      return await attempt(runtimeBaseUrl);
    }
    throw err;
  }
}

export type PayrollEmployee = {
  id: string;
  orgId: string;
  fullName: string;
  email: string;
  department: string;
  salary: number;
  payCycle: "monthly" | "biweekly";
  status: "active" | "on_leave" | "terminated";
  taxId?: string;
  nssf?: string;
  nhif?: string;
  paye?: string;
  bankName?: string;
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
  }) => request<AuthPayload>("/api/auth/signup", { method: "POST", body: JSON.stringify(body) }),

  login: (body: { email: string; password: string }) =>
    request<AuthPayload>("/api/auth/login", { method: "POST", body: JSON.stringify(body) }),

  listEmployees: (orgId: string) => request<PayrollEmployee[]>(`/api/employees?orgId=${encodeURIComponent(orgId)}`),

  addEmployee: (body: Omit<PayrollEmployee, "id" | "status">) =>
    request<PayrollEmployee>("/api/employees", { method: "POST", body: JSON.stringify(body) }),

  orgDashboard: (orgId: string) => request<DashboardStats>(`/api/dashboard/org?orgId=${encodeURIComponent(orgId)}`),

  systemDashboard: () => request<{ tenants: number; employees: number; payroll: number }>("/api/dashboard/system"),

  tenantAnalytics: () => request<TenantStats[]>("/api/analytics/tenants"),

  saveSettings: (body: SettingsPayload) =>
    request<SettingsPayload>("/api/settings", { method: "POST", body: JSON.stringify(body) }),

  getSettings: (orgId: string) => request<SettingsPayload>(`/api/settings?orgId=${encodeURIComponent(orgId)}`),

  sendSupport: (body: { name: string; email: string; subject: string; message: string }) =>
    request<{ sent: boolean; message: string }>("/api/support", { method: "POST", body: JSON.stringify(body) }),

  sendMail: (body: { to: string[]; subject: string; html: string }) =>
    request<{ sent: boolean; message: string }>("/api/mail/send", { method: "POST", body: JSON.stringify(body) }),

  listApprovals: (orgId: string) =>
    request<ApprovalItem[]>(`/api/approvals?orgId=${encodeURIComponent(orgId)}`),

  updateApprovalStatus: (body: { orgId: string; id: string; status: "pending" | "approved" | "rejected" }) =>
    request<ApprovalItem>("/api/approvals", { method: "POST", body: JSON.stringify(body) }),

  projectIntegrationStatus: () =>
    request<ProjectIntegrationStatus>("/api/integrations/project"),

  sendProjectReport: (body: { orgId: string; period: string; reportUrl?: string; summary?: string }) =>
    request<{ queued: boolean; message: string }>("/api/integrations/project/report", { method: "POST", body: JSON.stringify(body) }),
};
