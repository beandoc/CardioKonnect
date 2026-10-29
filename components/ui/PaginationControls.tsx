'use client'

import React from 'react'
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface PaginationControlsProps {
  currentPage: number
  totalItems: number
  pageSize: number
  onPageChange: (page: number) => void
  onPageSizeChange?: (size: number) => void
  pageSizeOptions?: number[]
  itemName?: string
  className?: string
}

export default function PaginationControls({
  currentPage,
  totalItems,
  pageSize,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 20, 30, 50, 100],
  itemName = 'records',
  className,
}: PaginationControlsProps) {
  if (totalItems <= 0) return null

  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))
  const validCurrentPage = Math.min(Math.max(1, currentPage), totalPages)
  const startIndex = (validCurrentPage - 1) * pageSize
  const endIndex = Math.min(startIndex + pageSize, totalItems)

  return (
    <div
      className={cn(
        "flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t border-gray-700/20 bg-slate-900/40 text-xs text-gray-300",
        className
      )}
    >
      {/* Range and page size */}
      <div className="flex items-center gap-3 text-gray-400 flex-wrap">
        <span>
          Showing <strong className="text-white font-semibold">{startIndex + 1}</strong> to{' '}
          <strong className="text-white font-semibold">{endIndex}</strong> of{' '}
          <strong className="text-white font-semibold">{totalItems}</strong> {itemName}
        </span>

        {onPageSizeChange && (
          <>
            <span className="text-gray-600 hidden sm:inline">|</span>
            <div className="flex items-center gap-1.5">
              <span className="text-gray-400">Rows per page:</span>
              <select
                value={pageSize}
                onChange={e => {
                  onPageSizeChange(Number(e.target.value))
                  onPageChange(1)
                }}
                className="bg-slate-800 border border-gray-700/50 text-white rounded px-2 py-0.5 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
              >
                {pageSizeOptions.map(opt => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>
          </>
        )}
      </div>

      {/* Navigation buttons */}
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onPageChange(1)}
          disabled={validCurrentPage === 1}
          className="p-1.5 rounded-lg btn-ghost disabled:opacity-30 disabled:pointer-events-none text-gray-400 hover:text-white transition-colors"
          title="First Page"
        >
          <ChevronsLeft className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => onPageChange(Math.max(1, validCurrentPage - 1))}
          disabled={validCurrentPage === 1}
          className="p-1.5 rounded-lg btn-ghost disabled:opacity-30 disabled:pointer-events-none text-gray-400 hover:text-white transition-colors"
          title="Previous Page"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-1 px-2.5">
          <span className="font-semibold text-blue-400">Page {validCurrentPage}</span>
          <span className="text-gray-500">of {totalPages}</span>
        </div>

        <button
          type="button"
          onClick={() => onPageChange(Math.min(totalPages, validCurrentPage + 1))}
          disabled={validCurrentPage === totalPages}
          className="p-1.5 rounded-lg btn-ghost disabled:opacity-30 disabled:pointer-events-none text-gray-400 hover:text-white transition-colors"
          title="Next Page"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => onPageChange(totalPages)}
          disabled={validCurrentPage === totalPages}
          className="p-1.5 rounded-lg btn-ghost disabled:opacity-30 disabled:pointer-events-none text-gray-400 hover:text-white transition-colors"
          title="Last Page"
        >
          <ChevronsRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

