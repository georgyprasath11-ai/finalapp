export const formatDuration = (durationMs: number): string => {
  const totalSeconds = Math.floor(durationMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes.toString().padStart(2, "0")}m`;
  }

  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
};

export const formatStudyTime = (totalSeconds: number): string => {
  const safeTotalSeconds = Number.isFinite(totalSeconds) ? Math.max(0, Math.floor(totalSeconds)) : 0;
  const hours = Math.floor(safeTotalSeconds / 3600);
  const minutes = Math.floor((safeTotalSeconds % 3600) / 60);
  const seconds = safeTotalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`;
  }

  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }

  return `${seconds}s`;
};
export const formatMinutes = (minutes: number): string => {
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    const remaining = minutes % 60;
    return remaining === 0 ? `${hours}h` : `${hours}h ${remaining}m`;
  }

  return `${minutes}m`;
};

export const formatHours = (hours: number): string => {
  const safe = Number.isFinite(hours) ? Math.max(0, hours) : 0;
  const rounded = Number(safe.toFixed(2));
  const text = Number.isInteger(rounded)
    ? rounded.toString()
    : rounded.toString().replace(/0+$/, "").replace(/\.$/, "");
  return `${text}h`;
};

export const percentLabel = (value: number): string => `${Math.round(value)}%`;

export const formatDateLabel = (isoDate: string): string =>
  new Date(`${isoDate}T00:00:00`).toLocaleDateString([], {
    month: "short",
    day: "numeric",
  });
