import Breadcrumbs from './Breadcrumbs';

export default function PageHeader({
  eyebrow,
  title,
  description,
  breadcrumbs = [],
  actions,
  meta,
  className = '',
}) {
  return (
    <header className={`mb-5 sm:mb-7 ${className}`}>
      {breadcrumbs.length > 0 && <div className="mb-3"><Breadcrumbs items={breadcrumbs} /></div>}
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
        <div className="min-w-0">
          {eyebrow && <p className="text-[9px] sm:text-[10px] font-extrabold uppercase tracking-[0.17em] text-blue-600 mb-1">{eyebrow}</p>}
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 break-words">{title}</h1>
            {meta}
          </div>
          {description && <p className="mt-1.5 text-sm text-slate-500 max-w-3xl leading-relaxed">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2 shrink-0">{actions}</div>}
      </div>
    </header>
  );
}
