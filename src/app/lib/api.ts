const DEFAULT_BASE_URL = (process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8080").replace(/\/+$/, "");
let runtimeBaseUrl = DEFAULT_BASE_URL;

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const urlPath = path.startsWith("/") ? path : `/${path}`;

  const attempt = async (baseUrl: string): Promise<T> => {
    const response = await fetch(`${baseUrl}${urlPath}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
      cache: "no-store",
    });

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
  status: "active" | "inactive";
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
};
