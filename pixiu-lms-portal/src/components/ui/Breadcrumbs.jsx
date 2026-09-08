import { ChevronRight, Home } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Breadcrumbs({ items = [], homeLabel = 'Home' }) {
  const normalized = items.filter(Boolean).map((item, index) => typeof item === 'string' ? ({ label: item, current: index === items.length - 1 }) : item);
  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 min-w-0 overflow-x-auto whitespace-nowrap text-[10px] sm:text-xs text-slate-400">
      <Link to="/" className="inline-flex items-center gap-1.5 shrink-0 rounded-md px-1 py-1 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
        <Home size={12} />
        <span className="hidden xs:inline">{homeLabel}</span>
      </Link>
      {normalized.map((item, index) => (
        <span key={`${item.label}-${index}`} className="inline-flex items-center gap-1.5 min-w-0 shrink-0">
          <ChevronRight size={12} className="text-slate-300" />
          {item.to && !item.current ? (
            <Link to={item.to} className="truncate hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded-md px-1 py-1">{item.label}</Link>
          ) : (
            <span aria-current={item.current ? 'page' : undefined} className={`truncate px-1 py-1 ${item.current ? 'font-semibold text-slate-600' : ''}`}>{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
