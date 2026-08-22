import { useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { money } from "../../lib/format";
import type { ExpenseTypeTotal } from "../../types/finance";
import { useBurndown } from "./useBurndown";

type BurndownChartProps = {
  month: string;
  expenseTypes: ExpenseTypeTotal[];
};

export function BurndownChart({ month, expenseTypes }: BurndownChartProps) {
  const [expenseTypeId, setExpenseTypeId] = useState("");
  const [categoryId, setCategoryId] = useState("");

  const selectedExpenseType = expenseTypes.find(
    (et) => et.expenseTypeId === expenseTypeId,
  );
  const categories = selectedExpenseType?.categories ?? [];

  function handleExpenseTypeChange(value: string) {
    setExpenseTypeId(value);
    setCategoryId("");
  }

  const { data, isLoading } = useBurndown(
    month,
    expenseTypeId || undefined,
    categoryId || undefined,
  );

  return (
    <section className="card">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="mb-1 text-xl">Spending burndown</h2>
          <p className="text-sm text-emerald-200">
            Pro-rated plan vs. cumulative actual spending, day by day.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <select
            className="rounded border border-emerald-700 bg-emerald-950 px-3 py-1.5 text-sm text-emerald-100"
            value={expenseTypeId}
            onChange={(e) => handleExpenseTypeChange(e.target.value)}
          >
            <option value="">All expense types</option>
            {expenseTypes.map((et) => (
              <option key={et.expenseTypeId} value={et.expenseTypeId}>
                {et.name}
              </option>
            ))}
          </select>
          {categories.length > 0 && (
            <select
              className="rounded border border-emerald-700 bg-emerald-950 px-3 py-1.5 text-sm text-emerald-100"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
            >
              <option value="">All categories</option>
              {categories.map((c) => (
                <option key={c.categoryId} value={c.categoryId}>
                  {c.name}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>
      {isLoading ? (
        <p className="py-8 text-sm text-emerald-200">Loading chart…</p>
      ) : !data?.length ? (
        <p className="py-8 text-sm text-emerald-200">
          No data available for this month.
        </p>
      ) : (
        <ResponsiveContainer width="100%" height={280}>
          <LineChart
            data={data}
            margin={{ top: 4, right: 16, left: 16, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#134e4a" />
            <XAxis
              dataKey="day"
              tick={{ fill: "#6ee7b7", fontSize: 12 }}
              tickLine={false}
              axisLine={{ stroke: "#134e4a" }}
            />
            <YAxis
              tickFormatter={(v: number) => money(v)}
              tick={{ fill: "#6ee7b7", fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              width={80}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#022c22",
                border: "1px solid #134e4a",
                borderRadius: "6px",
              }}
              labelStyle={{ color: "#6ee7b7" }}
              labelFormatter={(label) => `Day ${label}`}
                formatter={(value) => [money(value as number), ""]}
            />
            <Legend
              wrapperStyle={{ fontSize: 13, color: "#a7f3d0" }}
            />
            <Line
              type="monotone"
              dataKey="planned"
              name="Planned (pro-rated)"
              stroke="#84cc16"
              strokeWidth={2}
              dot={false}
              strokeDasharray="5 3"
            />
            <Line
              type="monotone"
              dataKey="actual"
              name="Actual"
              stroke="#34d399"
              strokeWidth={2}
              dot={false}
              connectNulls={false}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </section>
  );
}
