export const todayIsoDate = (date = new Date()): string => date.toISOString().split("T")[0];

export const addDays = (dateIso: string, deltaDays: number): string => {
  const date = new Date(`${dateIso}T00:00:00`);
  date.setDate(date.getDate() + deltaDays);
  return todayIsoDate(date);
};

export const isBeforeDate = (aIso: string, bIso: string): boolean => aIso < bIso;

export const startOfWeek = (base = new Date()): Date => {
  const date = new Date(base);
  const day = date.getDay();
  const delta = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + delta);
  date.setHours(0, 0, 0, 0);
  return date;
};

export const startOfMonth = (base = new Date()): Date => {
  const date = new Date(base);
  date.setDate(1);
  date.setHours(0, 0, 0, 0);
  return date;
};

export const toIsoMinuteLabel = (iso: string): string =>
  new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
