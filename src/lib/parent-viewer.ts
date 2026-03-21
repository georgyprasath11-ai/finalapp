import {
  PARENT_RATE_LIMIT_MAX_ATTEMPTS,
  PARENT_RATE_LIMIT_WINDOW_MS,
  STORAGE_KEYS,
} from "@/lib/constants";
import { browserStorageAdapter } from "@/lib/storage";
import { ParentViewerAuditEvent } from "@/types/models";
import { createId } from "@/utils/id";

const OTP_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const OTP_LENGTH = 16;
const MAX_AUDIT_EVENTS = 250;

interface RateLimitState {
  attempts: number[];
  blockedUntil: number;
  backoffStep: number;
}

export interface RateLimitResult {
  allowed: boolean;
  retryAfterMs: number;
}

export interface ParentViewerSession {
  role: "viewer";
  profileId: string;
  otpHash: string;
  authenticatedAt: string;
  expiresAt: string;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const defaultRateLimitState = (): RateLimitState => ({
  attempts: [],
  blockedUntil: 0,
  backoffStep: 0,
});

const randomBytes = (size: number): Uint8Array => {
  const cryptoApi = globalThis.crypto;
  if (!cryptoApi || typeof cryptoApi.getRandomValues !== "function") {
    throw new Error("Secure randomness is unavailable.");
  }

  const bytes = new Uint8Array(size);
  cryptoApi.getRandomValues(bytes);
  return bytes;
};

export const normalizeParentOtpInput = (value: string): string =>
  value.trim().replace(/[\s-]+/g, "").toUpperCase();

export const formatParentOtpForDisplay = (value: string): string => {
  const normalized = normalizeParentOtpInput(value);
  if (normalized.length <= 4) {
    return normalized;
  }

  return normalized.match(/.{1,4}/g)?.join("-") ?? normalized;
};

export const generateParentOtp = (length = OTP_LENGTH): string => {
  const targetLength = Math.max(16, Math.floor(length));
  const bytes = randomBytes(targetLength * 2);
  const chars: string[] = [];

  for (let index = 0; index < bytes.length && chars.length < targetLength; index += 1) {
    const value = bytes[index];
    if (value === undefined) {
      continue;
    }

    const bucket = value & 31;
    chars.push(OTP_ALPHABET[bucket] ?? OTP_ALPHABET[0]);
  }

  while (chars.length < targetLength) {
    chars.push(OTP_ALPHABET[0]);
  }

  return chars.join("");
};

export const sha256Hex = async (value: string): Promise<string> => {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw new Error("Web Crypto API is unavailable.");
  }

  const encoded = new TextEncoder().encode(value);
  const digest = await subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
};

export const constantTimeEqualHex = (left: string, right: string): boolean => {
  const maxLength = Math.max(left.length, right.length);
  let mismatch = left.length ^ right.length;

  for (let index = 0; index < maxLength; index += 1) {
    const leftCode = left.charCodeAt(index) || 0;
    const rightCode = right.charCodeAt(index) || 0;
    mismatch |= leftCode ^ rightCode;
  }

  return mismatch === 0;
};

const parseRateLimitState = (raw: unknown): RateLimitState => {
  if (!isRecord(raw)) {
    return defaultRateLimitState();
  }

  if (!Array.isArray(raw.attempts)) {
    return defaultRateLimitState();
  }

  const attempts = raw.attempts
    .map((value) => (typeof value === "number" && Number.isFinite(value) ? value : null))
    .filter((value): value is number => value !== null)
    .sort((a, b) => a - b);

  const blockedUntil = typeof raw.blockedUntil === "number" && Number.isFinite(raw.blockedUntil)
    ? raw.blockedUntil
    : 0;

  const backoffStep = typeof raw.backoffStep === "number" && Number.isFinite(raw.backoffStep)
    ? Math.max(0, Math.floor(raw.backoffStep))
    : 0;

  return {
    attempts,
    blockedUntil,
    backoffStep,
  };
};

const saveRateLimitState = async (profileId: string, clientId: string, state: RateLimitState): Promise<void> => {
  await browserStorageAdapter.set(STORAGE_KEYS.parentViewerRateLimit(profileId, clientId), state);
};

const readRateLimitState = async (profileId: string, clientId: string): Promise<RateLimitState> => {
  const raw = await browserStorageAdapter.get(STORAGE_KEYS.parentViewerRateLimit(profileId, clientId));
  return parseRateLimitState(raw);
};

const nextBackoffMs = (step: number): number => Math.min(60_000, Math.max(1_000, 2 ** step * 1_000));

export const consumeParentRateLimitAttempt = (
  profileId: string,
  clientId: string,
  nowMs = Date.now(),
): Promise<RateLimitResult> => {
  return (async () => {
    const state = await readRateLimitState(profileId, clientId);
    const windowStart = nowMs - PARENT_RATE_LIMIT_WINDOW_MS;
    const attempts = state.attempts.filter((timestamp) => timestamp >= windowStart);

    if (state.blockedUntil > nowMs) {
      const nextStep = Math.min(10, state.backoffStep + 1);
      const blockedUntil = nowMs + nextBackoffMs(nextStep);
      await saveRateLimitState(profileId, clientId, {
        attempts,
        blockedUntil,
        backoffStep: nextStep,
      });

      return {
        allowed: false,
        retryAfterMs: Math.max(0, blockedUntil - nowMs),
      };
    }

    if (attempts.length >= PARENT_RATE_LIMIT_MAX_ATTEMPTS) {
      const nextStep = Math.min(10, Math.max(1, state.backoffStep + 1));
      const blockedUntil = nowMs + nextBackoffMs(nextStep);
      await saveRateLimitState(profileId, clientId, {
        attempts,
        blockedUntil,
        backoffStep: nextStep,
      });

      return {
        allowed: false,
        retryAfterMs: Math.max(0, blockedUntil - nowMs),
      };
    }

    await saveRateLimitState(profileId, clientId, {
      attempts: [...attempts, nowMs],
      blockedUntil: 0,
      backoffStep: Math.max(0, state.backoffStep - 1),
    });

    return {
      allowed: true,
      retryAfterMs: 0,
    };
  })();
};

export const clearParentRateLimit = async (profileId: string, clientId: string): Promise<void> => {
  await browserStorageAdapter.remove(STORAGE_KEYS.parentViewerRateLimit(profileId, clientId));
};

export const getParentViewerClientId = async (): Promise<string> => {
  const existing = await browserStorageAdapter.get(STORAGE_KEYS.parentViewerClientId);
  if (typeof existing === "string" && existing.length > 0) {
    return existing;
  }

  const generated = `viewer-${generateParentOtp(20).slice(0, 20)}`;
  await browserStorageAdapter.set(STORAGE_KEYS.parentViewerClientId, generated);
  return generated;
};

export const readParentViewerSession = async (): Promise<ParentViewerSession | null> => {
  const raw = await browserStorageAdapter.get(STORAGE_KEYS.parentViewerSession);
  if (!isRecord(raw)) {
    return null;
  }

  if (
    raw.role !== "viewer" ||
    typeof raw.profileId !== "string" ||
    typeof raw.otpHash !== "string" ||
    typeof raw.authenticatedAt !== "string" ||
    typeof raw.expiresAt !== "string"
  ) {
    return null;
  }

  return {
    role: "viewer",
    profileId: raw.profileId,
    otpHash: raw.otpHash,
    authenticatedAt: raw.authenticatedAt,
    expiresAt: raw.expiresAt,
  };
};

export const writeParentViewerSession = async (session: ParentViewerSession): Promise<void> => {
  await browserStorageAdapter.set(STORAGE_KEYS.parentViewerSession, session);
};

export const clearParentViewerSession = async (): Promise<void> => {
  await browserStorageAdapter.remove(STORAGE_KEYS.parentViewerSession);
};

export const buildParentViewerAuditEvent = (
  userId: string,
  clientId: string,
  action: ParentViewerAuditEvent["action"],
  success: boolean,
  details?: string,
): ParentViewerAuditEvent => ({
  id: createId(),
  timestamp: new Date().toISOString(),
  userId,
  clientId,
  action,
  success,
  details,
});

export const appendParentViewerAuditEvent = (
  previous: ParentViewerAuditEvent[],
  event: ParentViewerAuditEvent,
): ParentViewerAuditEvent[] => {
  const trimmed = previous.length >= MAX_AUDIT_EVENTS
    ? previous.slice(previous.length - (MAX_AUDIT_EVENTS - 1))
    : previous;

  return [...trimmed, event];
};
