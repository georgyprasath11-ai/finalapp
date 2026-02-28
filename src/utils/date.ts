const padDatePart = (value: number): string => `${value}`.padStart(2, "0");

export const toLocalIsoDate = (date = new Date()): string =>
  `${date.getFullYear()}-${padDatePart(date.getMonth() + 1)}-${padDatePart(date.getDate())}`;

export const todayIsoDate = (date = new Date()): string => toLocalIsoDate(date);

export const parseIsoDateLocal = (isoDate: string): Date => {
  const [year, month, day] = isoDate.split("-").map((value) => Number(value));
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return new Date(NaN);
  }

  return new Date(year, month - 1, day, 0, 0, 0, 0);
};

export const addDays = (dateIso: string, deltaDays: number): string => {
  const date = parseIsoDateLocal(dateIso);
  if (Number.isNaN(date.getTime())) {
    return todayIsoDate();
  }

  date.setDate(date.getDate() + deltaDays);
  return toLocalIsoDate(date);
};

export const dayDiff = (fromIsoDate: string, toIsoDate: string): number => {
  const from = parseIsoDateLocal(fromIsoDate);
  const to = parseIsoDateLocal(toIsoDate);

  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    return 0;
  }

  const ms = to.getTime() - from.getTime();
  return Math.round(ms / 86_400_000);
};

export const isBeforeDate = (aIso: string, bIso: string): boolean => dayDiff(aIso, bIso) > 0;

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

export const startOfYear = (base = new Date()): Date => {
  const date = new Date(base);
  date.setMonth(0, 1);
  date.setHours(0, 0, 0, 0);
  return date;
};

export const toIsoMinuteLabel = (iso: string): string =>
  new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
