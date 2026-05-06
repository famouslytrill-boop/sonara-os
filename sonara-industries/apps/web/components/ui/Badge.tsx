export function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="readable-pill inline-flex rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide">
      {children}
    </span>
  );
}
