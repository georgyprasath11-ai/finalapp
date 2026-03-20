import { createClient } from '@supabase/supabase-js'

// Uses the service role key - this file only runs server-side in Vercel Functions
const supabase = createClient(
  process.env.VITE_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export async function requireAuth(req) {
  const authHeader = req.headers['authorization'] ?? ''
  const token = authHeader.replace('Bearer ', '').trim()

  if (!token) {
    return { user: null, error: 'Missing authorization header' }
  }

  try {
    const { data: { user }, error } = await supabase.auth.getUser(token)
    if (error || !user) {
      return { user: null, error: 'Invalid or expired token' }
    }
    return { user, error: null }
  } catch {
    return { user: null, error: 'Auth check failed' }
  }
}

export function addSecurityHeaders(res) {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('Referrer-Policy', 'no-referrer')
}

export function checkBodySize(req, res, limitBytes = 1_048_576) {
  const contentLength = parseInt(req.headers['content-length'] ?? '0', 10)
  if (contentLength > limitBytes) {
    res.status(413).json({ error: 'Request too large' })
    return false
  }
  return true
}
