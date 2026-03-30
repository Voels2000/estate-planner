'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatDistanceToNow } from 'date-fns'
import { NOTIFICATION_META } from './notification-meta'

type Notification = {
  id: string
  type: string
  title: string
  body: string
  read: boolean
  created_at: string
  metadata: Record<string, unknown>
}

async function fetchNotificationRows(): Promise<Notification[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(20)
  if (error) {
    console.error('notifications fetch:', error)
    return []
  }
  return data ?? []
}

export default function NotificationPanel({
  onRead,
  onClose,
}: {
  onRead: () => void
  onClose: () => void
}) {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const rows = await fetchNotificationRows()
      if (cancelled) return
      setNotifications(rows)
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  async function markAllRead() {
    const supabase = createClient()
    await supabase
      .from('notifications')
      .update({ read: true, read_at: new Date().toISOString() })
      .eq('read', false)
    const rows = await fetchNotificationRows()
    setNotifications(rows)
    onRead()
  }

  async function markOneRead(id: string) {
    const supabase = createClient()
    await supabase
      .from('notifications')
      .update({ read: true, read_at: new Date().toISOString() })
      .eq('id', id)
    setNotifications(prev =>
      prev.map(n => (n.id === id ? { ...n, read: true } : n))
    )
    onRead()
  }

  const unread = notifications.filter(n => !n.read)

  return (
    <div
      className="absolute right-0 top-10 z-50 w-56 rounded-xl border border-gray-200
                    bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
      role="dialog"
      aria-label="Notifications"
    >
      {/* Header */}
      <div
        className="flex items-center justify-between border-b border-gray-100
                      dark:border-zinc-800 px-4 py-3"
      >
        <span className="text-sm font-semibold text-gray-900 dark:text-zinc-50">
          Notifications
        </span>
        <div className="flex items-center gap-2">
          {unread.length > 0 && (
            <button
              type="button"
              onClick={() => void markAllRead()}
              className="text-xs text-blue-600 hover:underline dark:text-blue-400"
            >
              Mark all read
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="rounded p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
            aria-label="Close notifications"
          >
            ✕
          </button>
        </div>
      </div>

      {/* List */}
      <div className="max-h-96 overflow-y-auto divide-y divide-gray-50 dark:divide-zinc-800">
        {loading && (
          <p className="text-sm text-gray-400 text-center py-8">Loading…</p>
        )}
        {!loading && notifications.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-8">
            You&apos;re all caught up 🎉
          </p>
        )}
        {notifications.map(n => {
          const meta = NOTIFICATION_META[n.type]
          return (
            <div
              key={n.id}
              role="button"
              tabIndex={0}
              onClick={() => {
                if (!n.read) void markOneRead(n.id)
              }}
              onKeyDown={e => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  if (!n.read) void markOneRead(n.id)
                }
              }}
              className={`flex gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50
                          dark:hover:bg-zinc-800 transition
                          ${!n.read ? 'bg-blue-50 dark:bg-zinc-800/60' : ''}`}
            >
              <span className="text-xl mt-0.5">{meta?.icon ?? '🔔'}</span>
              <div className="flex-1 min-w-0">
                <p
                  className={`text-sm ${
                    !n.read
                      ? 'font-semibold text-gray-900 dark:text-zinc-50'
                      : 'text-gray-700 dark:text-zinc-300'
                  }`}
                >
                  {n.title}
                </p>
                <p className="text-xs text-gray-500 dark:text-zinc-400 mt-0.5 line-clamp-2">
                  {n.body}
                </p>
                <p className="text-xs text-gray-400 dark:text-zinc-500 mt-1">
                  {formatDistanceToNow(new Date(n.created_at), {
                    addSuffix: true,
                  })}
                </p>
              </div>
              {!n.read && (
                <span className="mt-1.5 h-2 w-2 rounded-full bg-blue-500 flex-shrink-0" />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
