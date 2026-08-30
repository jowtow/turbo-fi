import { useQuery, useQueryClient } from "@tanstack/react-query";
import { MonthPicker } from "../../components/MonthPicker";
import { PageHeading } from "../../components/PageHeading";
import { api } from "../../lib/api";
import { monthParams } from "../../lib/format";
import { useFinanceReferenceData } from "../finance/useFinanceReferenceData";
import { CategoryManager } from "./CategoryManager";
import { PlanForm } from "./PlanForm";

type PlanWorkspaceProps = {
  month: string;
  onMonthChange: (month: string) => void;
};

export function PlanWorkspace({ month, onMonthChange }: PlanWorkspaceProps) {
  const queryClient = useQueryClient();
  const { accounts, expenseTypes, categories } = useFinanceReferenceData(true);
  const entries = useQuery({
    queryKey: ["planned-entries", month],
    queryFn: () => api.get(`/planned-entries?${monthParams(month)}`),
  });
  const refresh = () => queryClient.invalidateQueries();

  return (
    <div className="workspace">
      <PageHeading
        eyebrow="Budget setup"
        title="Monthly plan"
        description="Each month starts from the previous month’s plan, then you can adjust it for what changed."
        actions={
          <MonthPicker month={month} onChange={onMonthChange} allowFuture />
        }
      />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <PlanForm
          expenseTypes={expenseTypes}
          categories={categories}
          entries={entries.data ?? []}
          month={month}
          onChanged={refresh}
        />
        <CategoryManager
          accounts={accounts}
          expenseTypes={expenseTypes}
          categories={categories}
          onChanged={refresh}
        />
      </div>
    </div>
  );
}
