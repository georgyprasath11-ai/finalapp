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

export const formatMinutes = (minutes: number): string => {
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    const remaining = minutes % 60;
    return remaining === 0 ? `${hours}h` : `${hours}h ${remaining}m`;
  }

  return `${minutes}m`;
};

export const percentLabel = (value: number): string => `${Math.round(value)}%`;

export const formatDateLabel = (isoDate: string): string =>
  new Date(`${isoDate}T00:00:00`).toLocaleDateString([], {
    month: "short",
    day: "numeric",
  });
