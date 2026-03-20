export class RateLimiter {
  private attempts = new Map<string, number[]>()
  private blocked = new Map<string, { until: number; step: number }>()

  constructor(
    private maxAttempts: number,
    private windowMs: number,
    private baseBlockMs: number,
  ) {}

  attempt(key: string): { allowed: boolean; retryAfterMs: number } {
    const now = Date.now()
    const block = this.blocked.get(key)

    if (block && block.until > now) {
      return { allowed: false, retryAfterMs: block.until - now }
    }

    const windowStart = now - this.windowMs
    const recent = (this.attempts.get(key) ?? []).filter(t => t > windowStart)

    if (recent.length >= this.maxAttempts) {
      const step = (block?.step ?? 0) + 1
      const blockMs = Math.min(this.baseBlockMs * Math.pow(2, step - 1), 15 * 60 * 1000)
      this.blocked.set(key, { until: now + blockMs, step })
      this.attempts.set(key, recent)
      return { allowed: false, retryAfterMs: blockMs }
    }

    this.attempts.set(key, [...recent, now])
    if (block) this.blocked.delete(key)
    return { allowed: true, retryAfterMs: 0 }
  }
}

// 5 send attempts per 60 seconds before blocking, starting with a 30s block
// that doubles with each repeated offence up to 15 minutes maximum
export const authRateLimiter = new RateLimiter(5, 60_000, 30_000)
