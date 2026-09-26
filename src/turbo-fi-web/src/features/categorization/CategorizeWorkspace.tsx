import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowDownUp, ArrowLeftRight, ArrowUp } from "lucide-react";
import { PageHeading } from "../../components/PageHeading";
import { api } from "../../lib/api";
import { money } from "../../lib/format";
import { useFinanceReferenceData } from "../finance/useFinanceReferenceData";
import type { Category, ReviewTransaction } from "../../types/finance";
import { CategorizationCard } from "./CategorizationCard";
import { CategoryBrowser } from "./CategoryBrowser";
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

type SortColumn = "date" | "description" | "amount" | "category";

function SortIcon({
  isActive,
  direction,
}: {
  isActive: boolean;
  direction: "ascending" | "descending";
}) {
  if (!isActive) return <ArrowDownUp aria-hidden="true" size={15} />;
  return direction === "ascending" ? (
    <ArrowUp aria-hidden="true" size={15} />
  ) : (
    <ArrowDown aria-hidden="true" size={15} />
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
  const [transferMessage, setTransferMessage] = useState("");
  const [markingTransferId, setMarkingTransferId] = useState<string>();
  const [sortColumn, setSortColumn] = useState<SortColumn>("date");
  const [sortDirection, setSortDirection] = useState<
    "ascending" | "descending"
  >("descending");

  const sortedTransactions = useMemo(() => {
    const direction = sortDirection === "ascending" ? 1 : -1;
    return [...transactions].sort((left, right) => {
      if (sortColumn === "amount") {
        return (left.amount - right.amount) * direction;
      }

      const leftValue =
        sortColumn === "date"
          ? left.transactionDate
          : sortColumn === "description"
            ? left.description
            : suggestedCategoryName(left, categories);
      const rightValue =
        sortColumn === "date"
          ? right.transactionDate
          : sortColumn === "description"
            ? right.description
            : suggestedCategoryName(right, categories);

      return leftValue.localeCompare(rightValue) * direction;
    });
  }, [categories, sortColumn, sortDirection, transactions]);

  function changeSort(column: SortColumn) {
    if (column === sortColumn) {
      setSortDirection((direction) =>
        direction === "ascending" ? "descending" : "ascending",
      );
      return;
    }

    setSortColumn(column);
    setSortDirection("ascending");
  }

  async function markTransfer(transaction: ReviewTransaction) {
    const destination = accounts.find(
      (account) =>
        account.id !== transaction.financialAccountId && account.isActive,
    );
    if (!destination) {
      setTransferMessage(
        "Add another active account before marking a transfer.",
      );
      return;
    }

    setTransferMessage("");
    setMarkingTransferId(transaction.id);
    try {
      await api.post(`/transactions/${transaction.id}/transfer`, {
        destinationAccountId: destination.id,
        destinationName: null,
      });
      await refresh();
    } catch (reason) {
      setTransferMessage(
        reason instanceof Error
          ? reason.message
          : "Unable to mark this transfer.",
      );
    } finally {
      setMarkingTransferId(undefined);
    }
  }

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
      <CategoryBrowser
        accounts={accounts}
        categories={categories}
        expenseTypes={expenseTypes}
      />
      {transactions.length > 1 && (
        <section className="card mt-6 overflow-x-auto">
          <h2 className="mb-4 text-lg font-semibold">All transactions</h2>
          {transferMessage && (
            <p className="mb-3 text-sm text-red-300" role="alert">
              {transferMessage}
            </p>
          )}
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-emerald-800 text-left text-emerald-300">
                <th
                  className="pb-2 pr-6 font-medium"
                  aria-sort={sortColumn === "date" ? sortDirection : "none"}
                >
                  <button
                    className="inline-flex items-center gap-1 rounded-none bg-transparent p-0 text-emerald-300 hover:bg-transparent hover:text-emerald-100"
                    type="button"
                    onClick={() => changeSort("date")}
                  >
                    Date
                    <SortIcon
                      isActive={sortColumn === "date"}
                      direction={sortDirection}
                    />
                  </button>
                </th>
                <th
                  className="pb-2 pr-6 font-medium"
                  aria-sort={
                    sortColumn === "description" ? sortDirection : "none"
                  }
                >
                  <button
                    className="inline-flex items-center gap-1 rounded-none bg-transparent p-0 text-emerald-300 hover:bg-transparent hover:text-emerald-100"
                    type="button"
                    onClick={() => changeSort("description")}
                  >
                    Description
                    <SortIcon
                      isActive={sortColumn === "description"}
                      direction={sortDirection}
                    />
                  </button>
                </th>
                <th
                  className="pb-2 pr-6 text-right font-medium"
                  aria-sort={sortColumn === "amount" ? sortDirection : "none"}
                >
                  <button
                    className="inline-flex items-center gap-1 rounded-none bg-transparent p-0 text-emerald-300 hover:bg-transparent hover:text-emerald-100"
                    type="button"
                    onClick={() => changeSort("amount")}
                  >
                    Amount
                    <SortIcon
                      isActive={sortColumn === "amount"}
                      direction={sortDirection}
                    />
                  </button>
                </th>
                <th
                  className="pb-2 pr-6 font-medium"
                  aria-sort={sortColumn === "category" ? sortDirection : "none"}
                >
                  <button
                    className="inline-flex items-center gap-1 rounded-none bg-transparent p-0 text-emerald-300 hover:bg-transparent hover:text-emerald-100"
                    type="button"
                    onClick={() => changeSort("category")}
                  >
                    Suggested category
                    <SortIcon
                      isActive={sortColumn === "category"}
                      direction={sortDirection}
                    />
                  </button>
                </th>
                <th className="pb-2 text-right font-medium">Mark Transfer</th>
              </tr>
            </thead>
            <tbody>
              {sortedTransactions.map((transaction) => (
                <tr
                  key={transaction.id}
                  className={`border-b border-emerald-900 ${transaction.id === transactions[0]?.id ? "bg-emerald-900/40" : ""}`}
                >
                  <td className="py-2 pr-6 text-emerald-300">
                    {transaction.transactionDate}
                  </td>
                  <td className="py-2 pr-6 max-w-xs truncate">
                    {transaction.id === transactions[0]?.id && (
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
                  <td className="py-2 text-right">
                    <button
                      className="bg-transparent text-sm text-emerald-200 hover:bg-emerald-900"
                      type="button"
                      disabled={markingTransferId === transaction.id}
                      onClick={() => markTransfer(transaction)}
                    >
                      {markingTransferId === transaction.id ? (
                        "..."
                      ) : (
                        <ArrowLeftRight />
                      )}
                    </button>
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
