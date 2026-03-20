import { DailyTaskHistoryDataset, DailyTasksState } from "@/types/models";

export interface DailyTaskHistoryRemotePayload {
  schemaVersion: 1;
  profileId: string;
  dailyTasksState: DailyTasksState;
  history: DailyTaskHistoryDataset;
  updatedAt: string;
}

const HISTORY_API_ENDPOINT = "/api/daily-task-history";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isDailyTaskHistoryRemotePayload = (value: unknown): value is DailyTaskHistoryRemotePayload => {
  if (!isRecord(value)) {
    return false;
  }

  return (
    value.schemaVersion === 1 &&
    typeof value.profileId === "string" &&
    isRecord(value.dailyTasksState) &&
    isRecord(value.history) &&
    typeof value.updatedAt === "string"
  );
};

export async function fetchDailyTaskHistoryRemote(
  profileId: string,
  signal?: AbortSignal,
): Promise<DailyTaskHistoryRemotePayload | null> {
  try {
    const response = await fetch(`${HISTORY_API_ENDPOINT}?profileId=${encodeURIComponent(profileId)}`, {
      method: "GET",
      signal,
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      return null;
    }

    const body = (await response.json()) as unknown;
    if (!isDailyTaskHistoryRemotePayload(body)) {
      return null;
    }

    return body;
  } catch {
    return null;
  }
}

export async function saveDailyTaskHistoryRemote(payload: DailyTaskHistoryRemotePayload): Promise<boolean> {
  try {
    const response = await fetch(HISTORY_API_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    return response.ok;
  } catch {
    return false;
  }
}
