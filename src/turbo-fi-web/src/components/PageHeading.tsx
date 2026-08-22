import type { ReactNode } from "react";

type PageHeadingProps = {
  eyebrow: string;
  title: string;
  description?: string;
  actions?: ReactNode;
};

export function PageHeading({
  eyebrow,
  title,
  description,
  actions,
}: PageHeadingProps) {
  return (
    <header className="workspace-heading">
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-lime-300">
          {eyebrow}
        </p>
        <h1>{title}</h1>
        {description && (
          <p className="mt-3 max-w-2xl text-emerald-200">{description}</p>
        )}
      </div>
      {actions}
    </header>
  );
}
