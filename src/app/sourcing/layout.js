// Sourcing was not redesigned. `.legacy` keeps Tailwind's default text sizes
// and the old page background so the page looks as it did before the new theme.
export default function SourcingLayout({ children }) {
  return (
    <div className="legacy min-h-full bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      {children}
    </div>
  );
}
