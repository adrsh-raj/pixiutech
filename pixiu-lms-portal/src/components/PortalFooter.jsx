export default function PortalFooter() {
  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-4 px-3 py-6 text-[11px] text-slate-500 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-9">
        <div>
          <p className="font-black tracking-[0.12em] text-slate-700">PIXIU TECH LLP</p>
          <p className="mt-1">Robotics • AI • IoT • STEM Education</p>
        </div>
        <nav className="flex flex-wrap items-center gap-x-4 gap-y-2 font-semibold" aria-label="Portal legal links">
          <a href="https://pixiutech.com" className="hover:text-slate-900">pixiutech.com</a>
          <a href="/privacy" className="hover:text-slate-900">Privacy Policy</a>
          <a href="/terms" className="hover:text-slate-900">Terms &amp; Conditions</a>
        </nav>
        <p className="lg:text-right">© {new Date().getFullYear()} Pixiu Tech LLP. All rights reserved.</p>
      </div>
    </footer>
  );
}
