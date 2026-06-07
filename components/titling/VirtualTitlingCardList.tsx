'use client'

import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { useWindowVirtualizer } from '@tanstack/react-virtual'
import {
  TITLING_CARD_ESTIMATED_HEIGHT,
  TITLING_CARD_LIST_GAP,
  TITLING_VIRTUALIZE_THRESHOLD,
} from '@/lib/titling/virtualizeConstants'

type VirtualTitlingCardListProps<T> = {
  items: T[]
  getItemKey: (item: T, index: number) => string
  renderItem: (item: T, index: number) => ReactNode
}

export default function VirtualTitlingCardList<T>({
  items,
  getItemKey,
  renderItem,
}: VirtualTitlingCardListProps<T>) {
  const listRef = useRef<HTMLDivElement>(null)
  const [scrollMargin, setScrollMargin] = useState(0)

  useLayoutEffect(() => {
    const el = listRef.current
    if (!el) return

    const updateScrollMargin = () => {
      setScrollMargin(el.offsetTop)
    }

    updateScrollMargin()

    const resizeObserver = new ResizeObserver(updateScrollMargin)
    resizeObserver.observe(el)
    if (el.parentElement) {
      resizeObserver.observe(el.parentElement)
    }

    window.addEventListener('resize', updateScrollMargin)
    return () => {
      resizeObserver.disconnect()
      window.removeEventListener('resize', updateScrollMargin)
    }
  }, [items.length])

  if (items.length < TITLING_VIRTUALIZE_THRESHOLD) {
    return (
      <div className="space-y-4">
        {items.map((item, index) => (
          <div key={getItemKey(item, index)}>{renderItem(item, index)}</div>
        ))}
      </div>
    )
  }

  return (
    <VirtualizedList
      items={items}
      scrollMargin={scrollMargin}
      listRef={listRef}
      getItemKey={getItemKey}
      renderItem={renderItem}
    />
  )
}

function VirtualizedList<T>({
  items,
  scrollMargin,
  listRef,
  getItemKey,
  renderItem,
}: VirtualTitlingCardListProps<T> & {
  scrollMargin: number
  listRef: React.RefObject<HTMLDivElement | null>
}) {
  const virtualizer = useWindowVirtualizer({
    count: items.length,
    estimateSize: () => TITLING_CARD_ESTIMATED_HEIGHT + TITLING_CARD_LIST_GAP,
    overscan: 3,
    scrollMargin,
    gap: TITLING_CARD_LIST_GAP,
  })

  useLayoutEffect(() => {
    virtualizer.measure()
  }, [scrollMargin, items.length])

  return (
    <div
      ref={listRef}
      style={{
        height: `${virtualizer.getTotalSize()}px`,
        width: '100%',
        position: 'relative',
      }}
    >
      {virtualizer.getVirtualItems().map((virtualRow) => {
        const item = items[virtualRow.index]
        return (
          <div
            key={getItemKey(item, virtualRow.index)}
            data-index={virtualRow.index}
            ref={virtualizer.measureElement}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              transform: `translateY(${virtualRow.start - scrollMargin}px)`,
            }}
          >
            {renderItem(item, virtualRow.index)}
          </div>
        )
      })}
    </div>
  )
}
