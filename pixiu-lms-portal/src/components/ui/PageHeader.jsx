import Breadcrumbs from './Breadcrumbs';
export default function PageHeader({ eyebrow, title, description, breadcrumbs = [], actions, meta, className = '' }) {
  return <header className={'mb-6 sm:mb-8 ' + className}>
    {breadcrumbs.length > 0 && <div className="mb-4"><Breadcrumbs items={breadcrumbs} /></div>}
    <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-5">
      <div className="min-w-0">
        {eyebrow && <p className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-[0.16em] text-[#27786D] mb-2">{eyebrow}</p>}
        <div className="flex flex-wrap items-center gap-2.5"><h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 break-words">{title}</h1>{meta}</div>
        {description && <p className="mt-2 text-sm text-slate-600 max-w-3xl leading-relaxed">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2 shrink-0">{actions}</div>}
    </div>
  </header>;
}
