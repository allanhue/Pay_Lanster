export type NotificationTag = "payrun" | "payslip" | "approval" | "system";

export type AppNotification = {
  id: string;
  title: string;
  detail: string;
  tag: NotificationTag;
  time: string;
  link?: string;
};

const STORAGE_KEY = "payroll_notifications";
const EVENT_NAME = "payroll_notifications_updated";

function readStorage(): AppNotification[] {
  if (typeof window === "undefined") return [];
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as AppNotification[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeStorage(items: AppNotification[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  window.dispatchEvent(new Event(EVENT_NAME));
}

export function getNotifications(): AppNotification[] {
  return readStorage();
}

export function addNotification(input: Omit<AppNotification, "id" | "time">): void {
  const items = readStorage();
  const item: AppNotification = {
    id: `ntf_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    time: new Date().toLocaleString(),
    ...input,
  };
  writeStorage([item, ...items].slice(0, 50));
}

export function removeNotification(id: string): void {
  const items = readStorage().filter((item) => item.id !== id);
  writeStorage(items);
}

export function clearNotifications(): void {
  writeStorage([]);
}

export function subscribeNotifications(callback: () => void): () => void {
  if (typeof window === "undefined") return () => undefined;
  const handler = () => callback();
  window.addEventListener(EVENT_NAME, handler);
  return () => window.removeEventListener(EVENT_NAME, handler);
}
