export function getOrgLogo(orgId?: string): string | null {
  if (typeof window === "undefined" || !orgId) return null;
  return window.localStorage.getItem(`org_logo_${orgId}`);
}

export function setOrgLogo(orgId: string, value: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(`org_logo_${orgId}`, value);
}

export function clearOrgLogo(orgId: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(`org_logo_${orgId}`);
}
