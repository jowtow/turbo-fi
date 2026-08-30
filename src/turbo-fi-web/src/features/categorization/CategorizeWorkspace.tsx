import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeading } from "../../components/PageHeading";
import { api } from "../../lib/api";
import { money } from "../../lib/format";
import { useFinanceReferenceData } from "../finance/useFinanceReferenceData";
import type { Category, ReviewTransaction } from "../../types/finance";
import { CategorizationCard } from "./CategorizationCard";
import { ImportCard } from "./ImportCard";

function suggestedCategoryName(
  transaction: ReviewTransaction,
  categories: Category[],
): string {
  if (!transaction.suggestedCategoryId) return "—";
  return (
    categories.find((c) => c.id === transaction.suggestedCategoryId)?.name ??
    "—"
  );
}

export function CategorizeWorkspace() {
  const queryClient = useQueryClient();
  const { accounts, expenseTypes, categories, phraseRules } =
    useFinanceReferenceData(true);
  const review = useQuery({
    queryKey: ["review"],
    queryFn: () => api.get("/transactions/review"),
  });
  const refresh = () => queryClient.invalidateQueries();
  const transactions: ReviewTransaction[] = review.data ?? [];

  return (
    <div className="workspace">
      <PageHeading
        eyebrow="Transaction inbox"
        title="Categorize transactions"
        description="Import a CSV, confirm a category, and move immediately to the next transaction."
      />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <CategorizationCard
          accounts={accounts}
          expenseTypes={expenseTypes}
          categories={categories}
          phraseRules={phraseRules}
          transactions={transactions}
          onChanged={refresh}
        />
        <ImportCard accounts={accounts} onImported={refresh} />
      </div>
      {transactions.length > 1 && (
        <section className="card mt-6 overflow-x-auto">
          <h2 className="mb-4 text-lg font-semibold">Upcoming transactions</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-emerald-800 text-left text-emerald-300">
                <th className="pb-2 pr-6 font-medium">Date</th>
                <th className="pb-2 pr-6 font-medium">Description</th>
                <th className="pb-2 pr-6 text-right font-medium">Amount</th>
                <th className="pb-2 font-medium">Suggested category</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((transaction, index) => (
                <tr
                  key={transaction.id}
                  className={`border-b border-emerald-900 ${index === 0 ? "bg-emerald-900/40" : ""}`}
                >
                  <td className="py-2 pr-6 text-emerald-300">
                    {transaction.transactionDate}
                  </td>
                  <td className="py-2 pr-6 max-w-xs truncate">
                    {index === 0 && (
                      <span className="mr-2 rounded-full bg-lime-700 px-2 py-0.5 text-xs text-lime-100">
                        Current
                      </span>
                    )}
                    {transaction.description}
                  </td>
                  <td
                    className={`py-2 pr-6 text-right tabular-nums ${transaction.amount < 0 ? "text-lime-300" : ""}`}
                  >
                    {money(transaction.amount)}
                  </td>
                  <td className="py-2 text-emerald-200">
                    {suggestedCategoryName(transaction, categories)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}
