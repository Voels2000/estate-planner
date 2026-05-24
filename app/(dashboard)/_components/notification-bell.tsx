'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import NotificationPanel from './notification-panel'

type Props = {
  /** Server-fetched initial count; client refresh after panel actions only. */
  initialUnreadCount?: number
}

export function NotificationBell({ initialUnreadCount = 0 }: Props) {
  const [open, setOpen] = useState(false)
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount)
  const rootRef = useRef<HTMLDivElement>(null)

  const refreshUnread = useCallback(async () => {
    const supabase = createClient()
    const { count, error } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('read', false)
    if (!error && count != null) setUnreadCount(count)
  }, [])

  useEffect(() => {
    setUnreadCount(initialUnreadCount)
  }, [initialUnreadCount])

  useEffect(() => {
    if (!open) return
    function handlePointerDown(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [open])

  return (
    <div className="relative shrink-0" ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="relative rounded-lg p-2 text-lg text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900"
        aria-expanded={open}
        aria-label="Notifications"
      >
        🔔
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>
      {open && (
        <NotificationPanel
          onRead={() => void refreshUnread()}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  )
}
