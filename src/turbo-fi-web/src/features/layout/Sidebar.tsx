import type { ReactNode } from "react";
import {
  BarChart3,
  CalendarDays,
  ListChecks,
  LogOut,
  Settings2,
} from "lucide-react";
import type { Workspace } from "../../types/finance";

type SidebarProps = {
  workspace: Workspace;
  householdName: string;
  reviewCount: number;
  onSelect: (workspace: Workspace) => void;
  onSignOut: () => Promise<void>;
};

export function Sidebar({
  workspace,
  householdName,
  reviewCount,
  onSelect,
  onSignOut,
}: SidebarProps) {
  const links: { id: Workspace; label: string; icon: ReactNode }[] = [
    { id: "dashboard", label: "Dashboard", icon: <BarChart3 size={19} /> },
    { id: "categorize", label: "Categorize", icon: <ListChecks size={19} /> },
    { id: "plan", label: "Monthly plan", icon: <CalendarDays size={19} /> },
    { id: "settings", label: "Settings", icon: <Settings2 size={19} /> },
  ];

  return (
    <aside className="app-sidebar">
      <div className="mb-10 flex flex-col items-center gap-3 px-3">
        <span className="grid place-items-center rounded-xl text-zinc-950">
          <img src="/turbofi.png" alt="Turbo Fi" />
        </span>
        <span className="text-xl font-bold tracking-tight">Turbo Fi</span>
      </div>
      <nav className="space-y-1">
        {links.map((link) => (
          <button
            key={link.id}
            className={`flex shrink-0 items-center gap-3 px-3 py-2 text-left ${workspace === link.id ? "bg-lime-400 text-zinc-950 hover:bg-lime-300" : "bg-transparent text-emerald-100 hover:bg-emerald-900"}`}
            onClick={() => onSelect(link.id)}
          >
            {link.icon}
            <span>{link.label}</span>
            {link.id === "categorize" && reviewCount > 0 && (
              <span
                className={`ml-auto rounded-full px-2 py-0.5 text-xs ${workspace === link.id ? "bg-zinc-950 text-lime-300" : "bg-emerald-800 text-lime-200"}`}
              >
                {reviewCount}
              </span>
            )}
          </button>
        ))}
      </nav>
      <div className="mt-auto border-t border-emerald-800/80 pt-5">
        <p className="px-3 text-sm font-medium text-emerald-100">
          {householdName}
        </p>
        <button
          className="mt-2 flex w-full items-center gap-2 bg-transparent text-emerald-300 hover:bg-emerald-900"
          onClick={onSignOut}
        >
          <LogOut size={17} />
          Sign out
        </button>
      </div>
    </aside>
  );
}
