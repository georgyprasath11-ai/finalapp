import { supabase } from '@/lib/supabase'

// Maps a localStorage key to its Supabase table destination.
// Returns null for keys that are ephemeral and should not be synced.
function resolveDestination(key: string): {
  table: string
  profileId: string | null
  conflictCols: string
} | null {
  const dataPrefix = 'study-dashboard:data:'
  const historyPrefix = 'study-dashboard:daily-task-history:'
  const profilesKey = 'study-dashboard:profiles'

  if (key.startsWith(dataPrefix)) {
    return {
      table: 'user_data',
      profileId: key.slice(dataPrefix.length),
      conflictCols: 'user_id,profile_id',
    }
  }
  if (key.startsWith(historyPrefix)) {
    return {
      table: 'daily_task_history',
      profileId: key.slice(historyPrefix.length),
      conflictCols: 'user_id,profile_id',
    }
  }
  if (key === profilesKey) {
    return {
      table: 'profiles_state',
      profileId: null,
      conflictCols: 'user_id',
    }
  }
  return null
}

// Fire-and-forget - never throws, never blocks the UI
export async function syncToSupabase(userId: string, key: string, value: string): Promise<void> {
  const dest = resolveDestination(key)
  if (!dest) return

  try {
    let parsed: unknown
    try {
      parsed = JSON.parse(value)
    } catch {
      return // Not valid JSON, skip
    }

    const row: Record<string, unknown> = {
      user_id: userId,
      data: parsed,
    }
    if (dest.profileId !== null) {
      row.profile_id = dest.profileId
    }

    const { error } = await supabase
      .from(dest.table)
      .upsert(row, { onConflict: dest.conflictCols })

    if (error) {
      console.error('[supabase-storage] sync error:', error.message)
    }
  } catch (err) {
    console.error('[supabase-storage] unexpected error:', err)
  }
}

// Loads all cloud data for a user and returns it as a key->jsonString map
// Returns empty object on any error - never throws
export async function loadFromSupabase(userId: string): Promise<Record<string, string>> {
  try {
    const [userData, historyData, profilesData] = await Promise.all([
      supabase.from('user_data').select('profile_id, data').eq('user_id', userId),
      supabase.from('daily_task_history').select('profile_id, data').eq('user_id', userId),
      supabase.from('profiles_state').select('data').eq('user_id', userId).maybeSingle(),
    ])

    const result: Record<string, string> = {}

    userData.data?.forEach(row => {
      result[`study-dashboard:data:${row.profile_id}`] = JSON.stringify(row.data)
    })

    historyData.data?.forEach(row => {
      result[`study-dashboard:daily-task-history:${row.profile_id}`] = JSON.stringify(row.data)
    })

    if (profilesData.data?.data) {
      result['study-dashboard:profiles'] = JSON.stringify(profilesData.data.data)
    }

    return result
  } catch (err) {
    console.error('[supabase-storage] load error:', err)
    return {}
  }
}
