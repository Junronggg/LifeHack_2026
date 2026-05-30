const navItems = [
  { label: 'About', href: '#about' },
  { label: 'Tracks', href: '#tracks' },
  { label: 'Timeline', href: '#timeline' },
  { label: 'Sponsors', href: '#sponsors' },
  { label: 'FAQ', href: '#faq' },
];

export default function Navbar() {
  return (
    <header className="fixed left-0 top-0 z-50 w-full border-b border-white/10 bg-slate-950/70 backdrop-blur-xl">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <a href="#" className="text-lg font-bold">
          LifeHack 2026
        </a>

        <div className="hidden gap-6 md:flex">
          {navItems.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="text-sm text-slate-300 transition hover:text-white"
            >
              {item.label}
            </a>
          ))}
        </div>

        <a
          href="#signup"
          className="rounded-full bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-300"
        >
          Sign Up
        </a>
      </nav>
    </header>
  );
}