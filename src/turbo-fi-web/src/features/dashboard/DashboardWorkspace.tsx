import { useEffect, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  CircleCheck,
  Inbox,
  WalletCards,
} from "lucide-react";
import { Metric } from "../../components/Metric";
import { MonthPicker } from "../../components/MonthPicker";
import { PageHeading } from "../../components/PageHeading";
import { SortableHeader, type SortDirection, TableControls } from "../../components/TableControls";
import { money, monthLabel } from "../../lib/format";
import type { CategoryTotal, ExpenseTypeTotal } from "../../types/finance";
import { useDashboard } from "./useDashboard";

type DashboardWorkspaceProps = {
  month: string;
  onMonthChange: (month: string) => void;
  onCategorize: () => void;
};

type DashboardRowData = CategoryTotal & {
  expenseTypeId: string;
  expenseTypeName: string;
  variance: number;
  status: "Over plan" | "On track";
};

type DashboardSortColumn = "category" | "planned" | "actual" | "variance" | "status";
type DashboardSorting = { column: DashboardSortColumn; direction: SortDirection };

export function DashboardWorkspace({
  month,
  onMonthChange,
  onCategorize,
}: DashboardWorkspaceProps) {
  const dashboard = useDashboard(month, true);
  const [search, setSearch] = useState("");
  const [expenseTypeFilter, setExpenseTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [sorting, setSorting] = useState<DashboardSorting>();
  const expenseTypes = dashboard.data?.expenseTypes ?? [];
  const planned = expenseTypes.reduce((sum, item) => sum + item.planned, 0);
  const actual = expenseTypes.reduce((sum, item) => sum + item.actual, 0);
  const filteredExpenseTypes = expenseTypes
    .map((expenseType) => ({
      ...expenseType,
      categories: expenseType.categories.filter((category) => {
        const query = search.trim().toLocaleLowerCase();
        const overPlan =
          category.planned > 0 && category.actual > category.planned;
        const status = overPlan ? "Over plan" : "On track";
        return (
          (!query ||
            category.name.toLocaleLowerCase().includes(query) ||
            expenseType.name.toLocaleLowerCase().includes(query)) &&
          (!expenseTypeFilter ||
            expenseType.expenseTypeId === expenseTypeFilter) &&
          (!statusFilter || status === statusFilter)
        );
      }),
    }))
    .filter((expenseType) => expenseType.categories.length > 0);
  const rows: DashboardRowData[] = filteredExpenseTypes.flatMap((expenseType) =>
    expenseType.categories.map((category) => {
      const overPlan =
        category.planned > 0 && category.actual > category.planned;
      return {
        ...category,
        expenseTypeId: expenseType.expenseTypeId,
        expenseTypeName: expenseType.name,
        variance: category.actual - category.planned,
        status: overPlan ? "Over plan" : "On track",
      };
    }),
  );
  const sortedRows = sorting
    ? [...rows].sort((left, right) => {
        const comparison =
          sorting.column === "category"
            ? left.name.localeCompare(right.name)
            : sorting.column === "status"
              ? left.status.localeCompare(right.status)
              : left[sorting.column] - right[sorting.column];
        return sorting.direction === "asc" ? comparison : -comparison;
      })
    : rows;

  useEffect(() => {
    setSearch("");
    setExpenseTypeFilter("");
    setStatusFilter("");
    setSorting(undefined);
  }, [month]);

  function clearTableControls() {
    setSearch("");
    setExpenseTypeFilter("");
    setStatusFilter("");
    setSorting(undefined);
  }

  function toggleSort(column: DashboardSortColumn) {
    setSorting((current) =>
      current?.column === column
        ? current.direction === "asc"
          ? { column, direction: "desc" }
          : undefined
        : { column, direction: "asc" },
    );
  }

  return (
    <div className="workspace">
      <PageHeading
        eyebrow="Operating view"
        title={monthLabel(month)}
        actions={<MonthPicker month={month} onChange={onMonthChange} />}
      />
      <section className="mb-7 grid gap-4 md:grid-cols-3">
        <Metric icon={<BarChart3 />} label="Planned" value={money(planned)} />
        <Metric
          icon={<WalletCards />}
          label="Actual spending"
          value={money(actual)}
        />
        <Metric
          icon={<Inbox />}
          label="To categorize"
          value={String(dashboard.data?.reviewCount ?? 0)}
          action={
            dashboard.data?.reviewCount ? (
              <button
                className="mt-3 bg-emerald-900 text-lime-200 hover:bg-emerald-800"
                onClick={onCategorize}
              >
                Review transactions{" "}
                <ArrowRight size={16} className="ml-1 inline" />
              </button>
            ) : undefined
          }
        />
      </section>
      <section className="card">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="mb-1 text-xl">Planned versus actual</h2>
            <p className="text-sm text-emerald-200">
              Expense types are ordered by actual spending; categories by their
              larger planned or actual amount.
            </p>
          </div>
          <span
            className={`rounded-full px-3 py-1 text-sm font-medium ${actual > planned ? "bg-red-950 text-red-200" : "bg-lime-950 text-lime-300"}`}
          >
            {money(actual - planned)} {actual > planned ? "over" : "remaining"}
          </span>
        </div>
        <TableControls
          searchLabel="Search categories or expense types"
          searchValue={search}
          onSearchChange={setSearch}
          filters={[
            {
              id: "expense-type",
              label: "Expense type",
              value: expenseTypeFilter,
              onChange: setExpenseTypeFilter,
              options: [
                { label: "All expense types", value: "" },
                ...expenseTypes.map((type) => ({
                  label: type.name,
                  value: type.expenseTypeId,
                })),
              ],
            },
            {
              id: "status",
              label: "Status",
              value: statusFilter,
              onChange: setStatusFilter,
              options: [
                { label: "All statuses", value: "" },
                { label: "Over plan", value: "Over plan" },
                { label: "On track", value: "On track" },
              ],
            },
          ]}
          onClear={clearTableControls}
          hasFilters={Boolean(
            search || expenseTypeFilter || statusFilter || sorting,
          )}
        />
        <div className="overflow-x-auto">
          <table>
            <thead>
              <tr>
                <th>
                  <SortableHeader direction={sorting?.column === "category" ? sorting.direction : undefined} label="Category" onSort={() => toggleSort("category")} />
                </th>
                <th>
                  <SortableHeader direction={sorting?.column === "planned" ? sorting.direction : undefined} label="Plan" onSort={() => toggleSort("planned")} />
                </th>
                <th>
                  <SortableHeader direction={sorting?.column === "actual" ? sorting.direction : undefined} label="Actual" onSort={() => toggleSort("actual")} />
                </th>
                <th>
                  <SortableHeader direction={sorting?.column === "variance" ? sorting.direction : undefined} label="Variance" onSort={() => toggleSort("variance")} />
                </th>
                <th>
                  <SortableHeader direction={sorting?.column === "status" ? sorting.direction : undefined} label="Status" onSort={() => toggleSort("status")} />
                </th>
              </tr>
            </thead>
            <tbody>
              {sorting
                ? sortedRows.map((row) => (
                      <DashboardRow
                        key={row.categoryId}
                        item={row}
                        expenseTypeName={row.expenseTypeName}
                      />
                    ))
                : filteredExpenseTypes.map((expenseType) => (
                    <ExpenseTypeGroup
                      key={expenseType.expenseTypeId}
                      expenseType={expenseType}
                    />
                  ))}
            </tbody>
          </table>
        </div>
        {!expenseTypes.length && (
          <p className="py-5 text-sm text-emerald-200">
            Create a monthly plan to start tracking this month.
          </p>
        )}
        {!!expenseTypes.length && !rows.length && (
          <p className="py-5 text-sm text-emerald-200">
            No categories match these filters.
          </p>
        )}
      </section>
    </div>
  );
}

function ExpenseTypeGroup({ expenseType }: { expenseType: ExpenseTypeTotal }) {
  return (
    <>
      <tr>
        <th
          className="bg-emerald-950/70 px-3 py-3 text-left text-xs font-semibold uppercase tracking-[0.14em] text-lime-300"
          colSpan={5}
          scope="rowgroup"
        >
          {expenseType.name}
          <span className="ml-3 normal-case tracking-normal text-emerald-300">
            {expenseType.categories.length} categories ·{" "}
            {money(expenseType.actual)} actual
          </span>
        </th>
      </tr>
      {expenseType.categories.map((item) => (
        <DashboardRow key={item.categoryId} item={item} />
      ))}
    </>
  );
}

function DashboardRow({
  item,
  expenseTypeName,
}: {
  item: CategoryTotal;
  expenseTypeName?: string;
}) {
  const overPlan = item.planned > 0 && item.actual > item.planned;
  const status = overPlan
    ? {
        label: "Over plan",
        classes: "bg-red-950 text-red-200",
        icon: <AlertTriangle size={14} />,
      }
    : {
        label: "On track",
        classes: "bg-lime-950 text-lime-300",
        icon: <CircleCheck size={14} />,
      };

  return (
    <tr className={overPlan ? "bg-red-950/25" : ""}>
      <td>
        <strong>{item.name}</strong>
        <span className="ml-2 text-xs text-emerald-300">
          {item.isFixed ? "Fixed" : "Target"}
        </span>
        {expenseTypeName && (
          <span className="ml-2 text-xs text-emerald-300">
            {expenseTypeName}
          </span>
        )}
      </td>
      <td>{money(item.planned)}</td>
      <td className={overPlan ? "font-semibold text-red-300" : ""}>
        {money(item.actual)}
      </td>
      <td
        className={
          item.actual - item.planned > 0 ? "text-red-300" : "text-lime-300"
        }
      >
        {money(item.actual - item.planned)}
      </td>
      <td>
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium ${status.classes}`}
        >
          {status.icon}
          {status.label}
        </span>
      </td>
    </tr>
  );
}
