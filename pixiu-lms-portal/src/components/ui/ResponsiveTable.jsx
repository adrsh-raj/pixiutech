import { ChevronLeft, ChevronRight } from 'lucide-react';

export default function ResponsiveTable({
  columns = [],
  rows = [],
  rowKey = (row, index) => row?.id ?? index,
  renderMobileRow,
  empty,
  pagination,
  className = '',
}) {
  return (
    <div className={`rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden ${className}`}>
      {renderMobileRow ? (
        <div className="md:hidden divide-y divide-slate-100">
          {rows.map((row, index) => <div key={rowKey(row, index)}>{renderMobileRow(row, index)}</div>)}
          {!rows.length && empty}
        </div>
      ) : null}

      <div className={renderMobileRow ? 'hidden md:block overflow-x-auto' : 'overflow-x-auto'}>
        <table className="w-full min-w-[680px] text-left text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>{columns.map(column => <th key={column.key} className="px-4 py-3 text-[10px] font-black uppercase tracking-wider text-slate-500 whitespace-nowrap">{column.label}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row, index) => <tr key={rowKey(row, index)} className="hover:bg-slate-50/70 transition-colors">{columns.map(column => <td key={column.key} className={`px-4 py-3.5 align-middle ${column.className || ''}`}>{typeof column.render === 'function' ? column.render(row, index) : row?.[column.key] ?? '—'}</td>)}</tr>)}
          </tbody>
        </table>
        {!rows.length && empty}
      </div>

      {pagination && pagination.totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t border-slate-100 bg-white">
          <span className="text-[11px] text-slate-500">Page {pagination.page} of {pagination.totalPages}</span>
          <div className="flex items-center gap-2">
            <button type="button" onClick={pagination.onPrevious} disabled={pagination.page <= 1} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed" aria-label="Previous page"><ChevronLeft size={14}/> Previous</button>
            <button type="button" onClick={pagination.onNext} disabled={pagination.page >= pagination.totalPages} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed" aria-label="Next page">Next <ChevronRight size={14}/></button>
          </div>
        </div>
      )}
    </div>
  );
}
