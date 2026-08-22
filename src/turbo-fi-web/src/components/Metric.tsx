import type { ReactNode } from "react";

type MetricProps = {
  icon: ReactNode;
  label: string;
  value: string;
  action?: ReactNode;
};

export function Metric({ icon, label, value, action }: MetricProps) {
  return (
    <div className="card">
      <div className="flex items-center gap-2 text-emerald-200">
        {icon}
        <span>{label}</span>
      </div>
      <strong className="mt-2 block text-3xl">{value}</strong>
      {action}
    </div>
  );
}
