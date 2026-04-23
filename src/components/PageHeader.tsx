export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}) {
  return (
    <header className="border-b border-ink-100 bg-white">
      <div className="px-8 py-5 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">{title}</h1>
          {subtitle && (
            <p className="text-sm text-ink-500 mt-0.5">{subtitle}</p>
          )}
        </div>
        {actions}
      </div>
    </header>
  );
}
