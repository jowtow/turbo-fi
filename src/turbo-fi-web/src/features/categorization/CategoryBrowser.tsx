import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Pencil, X } from "lucide-react";
import { MonthPicker } from "../../components/MonthPicker";
import { api } from "../../lib/api";
import { money, monthLabel } from "../../lib/format";
import type {
  Account,
  Category,
  CategorySpending,
  ExpenseType,
  Transaction,
} from "../../types/finance";

type CategoryBrowserProps = {
  accounts: Account[];
  categories: Category[];
  expenseTypes: ExpenseType[];
};

function categoryOptions(categories: Category[], expenseTypes: ExpenseType[]) {
  return expenseTypes.map((type) => ({
    type,
    categories: categories.filter(
      (category) =>
        category.expenseTypeId === type.id && !category.isArchived,
    ),
  }));
}

export function CategoryBrowser({
  accounts,
  categories,
  expenseTypes,
}: CategoryBrowserProps) {
  const queryClient = useQueryClient();
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [accountId, setAccountId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [uncategorized, setUncategorized] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction>();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState("");
  const [editCategoryId, setEditCategoryId] = useState("");
  const [saving, setSaving] = useState(false);
  const [year, numericMonth] = month.split("-").map(Number);
  const baseQuery = `year=${year}&month=${numericMonth}${accountId ? `&accountId=${accountId}` : ""}`;
  const query = `${baseQuery}${categoryId ? `&categoryId=${categoryId}` : ""}${uncategorized ? "&uncategorized=true" : ""}`;
  const transactions = useQuery({
    queryKey: ["transactions", query],
    queryFn: () => api.get(`/transactions?${query}`),
  });
  const allTransactions = useQuery({
    queryKey: ["transactions", baseQuery],
    queryFn: () => api.get(`/transactions?${baseQuery}`),
    enabled: Boolean(categoryId || uncategorized),
  });
  const summary = useQuery({
    queryKey: ["category-spending", baseQuery],
    queryFn: () => api.get(`/transactions/categories?${baseQuery}`),
  });
  const items: Transaction[] = transactions.data ?? [];
  const totals: CategorySpending[] = summary.data ?? [];
  const totalSpending = totals.reduce((sum, item) => sum + item.amount, 0);
  const transactionsForUncategorizedCount =
    categoryId || uncategorized ? allTransactions.data ?? [] : items;
  const uncategorizedCount = transactionsForUncategorizedCount.filter(
    (item) => !item.categoryId,
  ).length;
  const options = categoryOptions(categories, expenseTypes);

  function selectCategory(id: string) {
    setCategoryId(id);
    setUncategorized(false);
    setSelectedTransaction(undefined);
    setMessage("");
  }

  function selectUncategorized() {
    setCategoryId("");
    setUncategorized(true);
    setSelectedTransaction(undefined);
    setMessage("");
  }

  function clearCategoryFilter() {
    setCategoryId("");
    setUncategorized(false);
    setSelectedTransaction(undefined);
  }

  function startEditing(transaction: Transaction) {
    setEditingId(transaction.id);
    setEditCategoryId(transaction.categoryId ?? "");
    setError("");
  }

  async function changeCategory(transaction: Transaction) {
    if (!editCategoryId) {
      setError("Choose a category.");
      return;
    }

    setSaving(true);
    setError("");
    try {
      await api.put(`/transactions/${transaction.id}/category`, {
        categoryId: editCategoryId,
      });
      setEditingId("");
      setSelectedTransaction((current) =>
        current?.id === transaction.id
          ? {
              ...current,
              categoryId: editCategoryId,
              categoryName:
                categories.find((category) => category.id === editCategoryId)
                  ?.name,
            }
          : current,
      );
      setMessage(`Category updated for ${transaction.description}.`);
      await queryClient.invalidateQueries({ queryKey: ["transactions"] });
      await queryClient.invalidateQueries({ queryKey: ["category-spending"] });
      await queryClient.invalidateQueries({ queryKey: ["review"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Unable to update this transaction's category.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="mt-8">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-2 text-sm uppercase tracking-wider text-emerald-300">
            Spending activity
          </p>
          <h2 className="mb-1 text-2xl">Browse categorized transactions</h2>
          <p className="text-sm text-emerald-200">
            Review spending by category and correct a transaction when needed.
          </p>
        </div>
        <MonthPicker month={month} onChange={setMonth} />
      </div>

      <div className="mb-6 flex flex-wrap items-end gap-3">
        <div className="w-64">
          <label
            className="mb-1 block text-sm font-medium text-emerald-100"
            htmlFor="transaction-account"
          >
            Account
          </label>
          <select
            id="transaction-account"
            value={accountId}
            onChange={(event) => {
              setAccountId(event.target.value);
              setSelectedTransaction(undefined);
            }}
          >
            <option value="">All accounts</option>
            {accounts
              .filter((account) => account.isActive)
              .map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
          </select>
        </div>
        <div className="w-64">
          <label
            className="mb-1 block text-sm font-medium text-emerald-100"
            htmlFor="transaction-category"
          >
            Category
          </label>
          <select
            id="transaction-category"
            value={uncategorized ? "uncategorized" : categoryId}
            onChange={(event) => {
              const value = event.target.value;
              setSelectedTransaction(undefined);
              setMessage("");
              if (value === "uncategorized") {
                setCategoryId("");
                setUncategorized(true);
              } else {
                setCategoryId(value);
                setUncategorized(false);
              }
            }}
          >
            <option value="">All categories</option>
            <option value="uncategorized">Uncategorized</option>
            {options.map(({ type, categories: typedCategories }) =>
              typedCategories.length ? (
                <optgroup key={type.id} label={type.name}>
                  {typedCategories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </optgroup>
              ) : null,
            )}
          </select>
        </div>
        {(categoryId || uncategorized) && (
          <button
            className="bg-emerald-900 text-lime-200 hover:bg-emerald-800"
            type="button"
            onClick={clearCategoryFilter}
          >
            <X className="mr-1 inline" size={16} />
            Clear category filter
          </button>
        )}
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(18rem,0.8fr)_minmax(0,1.5fr)]">
        <section className="card">
          <div className="mb-4 flex items-baseline justify-between gap-3">
            <div>
              <h3 className="mb-1 text-lg font-semibold">
                {monthLabel(month)} spending
              </h3>
              <p className="text-sm text-emerald-200">
                {money(totalSpending)} across {totals.length} categories
              </p>
            </div>
          </div>
          {summary.isError ? (
            <p className="text-sm text-red-300" role="alert">
              Unable to load category spending.
            </p>
          ) : totals.length ? (
            <div className="space-y-2">
              {totals.map((total) => (
                <button
                  key={total.categoryId}
                  className={`flex w-full items-center justify-between gap-3 text-left ${categoryId === total.categoryId ? "bg-lime-400 text-zinc-950 hover:bg-lime-300" : "bg-emerald-950 text-emerald-100 hover:bg-emerald-900"}`}
                  type="button"
                  onClick={() => selectCategory(total.categoryId)}
                >
                  <span className="min-w-0">
                    <strong className="block truncate">{total.name}</strong>
                    <span
                      className={`text-xs ${categoryId === total.categoryId ? "text-zinc-700" : "text-emerald-300"}`}
                    >
                      {total.transactionCount}{" "}
                      {total.transactionCount === 1 ? "transaction" : "transactions"}
                    </span>
                  </span>
                  <span className="shrink-0 tabular-nums">{money(total.amount)}</span>
                </button>
              ))}
            </div>
          ) : (
            <p className="py-4 text-sm text-emerald-200">
              No categorized spending for these filters. Review uncategorized
              transactions to get started.
            </p>
          )}
          {uncategorizedCount > 0 && (
            <button
              className={`mt-5 flex w-full items-center justify-between ${uncategorized ? "bg-amber-700 text-zinc-950 hover:bg-amber-600" : "bg-amber-950 text-amber-100 hover:bg-amber-900"}`}
              type="button"
              onClick={selectUncategorized}
            >
              <span>Uncategorized transactions</span>
              <span className="rounded-full bg-amber-800 px-2 py-0.5 text-sm">
                {uncategorizedCount}
              </span>
            </button>
          )}
        </section>

        <section className="card min-w-0">
          <div className="mb-5">
            <div>
              <h3 className="mb-1 text-lg font-semibold">
                {uncategorized
                  ? "Uncategorized transactions"
                  : categoryId
                    ? totals.find((total) => total.categoryId === categoryId)
                        ?.name ?? "Category transactions"
                    : "All transactions"}
              </h3>
              <p className="text-sm text-emerald-200">
                {categoryId
                  ? `${money(totals.find((total) => total.categoryId === categoryId)?.amount ?? 0)} · ${items.length} ${items.length === 1 ? "transaction" : "transactions"}`
                  : `${items.length} ${items.length === 1 ? "transaction" : "transactions"} in ${monthLabel(month)}`}
              </p>
            </div>
          </div>
          {message && (
            <p className="mb-4 rounded-lg bg-lime-950 px-3 py-2 text-sm text-lime-200" role="status">
              {message}
            </p>
          )}
          {transactions.isError && (
            <p className="mb-4 text-sm text-red-300" role="alert">
              Unable to load transactions.
            </p>
          )}
          <div className="overflow-x-auto">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Description</th>
                  <th>Category</th>
                  <th className="text-right">Amount</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {items.map((transaction) => (
                  <tr
                    key={transaction.id}
                    className={`cursor-pointer hover:bg-emerald-950/60 ${selectedTransaction?.id === transaction.id ? "bg-emerald-950/80" : ""}`}
                    onClick={() => setSelectedTransaction(transaction)}
                  >
                    <td className="whitespace-nowrap text-emerald-300">
                      {transaction.transactionDate}
                    </td>
                    <td>
                      <strong className="block">{transaction.description}</strong>
                      <span className="text-xs text-emerald-300">
                        {transaction.accountName}
                      </span>
                    </td>
                    <td>
                      {editingId === transaction.id ? (
                        <select
                          aria-label={`Category for ${transaction.description}`}
                          className="min-w-44 py-1.5 text-sm"
                          value={editCategoryId}
                          onClick={(event) => event.stopPropagation()}
                          onChange={(event) => setEditCategoryId(event.target.value)}
                        >
                          <option value="">Choose a category</option>
                          {options.map(({ type, categories: typedCategories }) =>
                            typedCategories.length ? (
                              <optgroup key={type.id} label={type.name}>
                                {typedCategories.map((category) => (
                                  <option key={category.id} value={category.id}>
                                    {category.name}
                                  </option>
                                ))}
                              </optgroup>
                            ) : null,
                          )}
                        </select>
                      ) : (
                        <span className={transaction.categoryName ? "" : "text-amber-300"}>
                          {transaction.categoryName ?? "Uncategorized"}
                        </span>
                      )}
                    </td>
                    <td className={`text-right tabular-nums ${transaction.amount < 0 ? "text-lime-300" : ""}`}>
                      {money(transaction.amount)}
                    </td>
                    <td className="whitespace-nowrap text-right">
                      {editingId === transaction.id ? (
                        <>
                          <button
                            aria-label={`Save category for ${transaction.description}`}
                            className="mr-1 px-2 py-1.5 text-sm"
                            disabled={saving}
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              void changeCategory(transaction);
                            }}
                          >
                            <Check size={16} />
                          </button>
                          <button
                            aria-label="Cancel category edit"
                            className="bg-transparent px-2 py-1.5 text-emerald-300 hover:bg-emerald-900"
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              setEditingId("");
                              setError("");
                            }}
                          >
                            <X size={16} />
                          </button>
                        </>
                      ) : (
                        <button
                          aria-label={`Change category for ${transaction.description}`}
                          className="bg-transparent px-2 py-1.5 text-emerald-200 hover:bg-emerald-900"
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            startEditing(transaction);
                          }}
                        >
                          <Pencil size={16} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!transactions.isLoading && !items.length && (
            <p className="py-6 text-center text-sm text-emerald-200">
              No transactions match these filters.
            </p>
          )}
          {error && (
            <p className="mt-3 text-sm text-red-300" role="alert">
              {error}
            </p>
          )}
          {selectedTransaction && (
            <div className="mt-6 rounded-xl border border-emerald-800 bg-emerald-950/50 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm uppercase tracking-wider text-emerald-300">
                    Transaction details
                  </p>
                  <h4 className="mt-1 text-lg font-semibold">
                    {selectedTransaction.description}
                  </h4>
                  <p className="mt-1 text-sm text-emerald-200">
                    {selectedTransaction.transactionDate} ·{" "}
                    {selectedTransaction.accountName} ·{" "}
                    {money(selectedTransaction.amount)}
                  </p>
                </div>
                <button
                  className="bg-transparent px-2 py-1.5 text-emerald-300 hover:bg-emerald-900"
                  aria-label="Close transaction details"
                  type="button"
                  onClick={() => setSelectedTransaction(undefined)}
                >
                  <X size={17} />
                </button>
              </div>
              <div className="mt-4 flex flex-wrap items-end gap-3">
                <div className="min-w-60 flex-1">
                  <label
                    className="mb-1 block text-sm font-medium text-emerald-100"
                    htmlFor="detail-category"
                  >
                    Category
                  </label>
                  <select
                    id="detail-category"
                    value={
                      editingId === selectedTransaction.id
                        ? editCategoryId
                        : selectedTransaction.categoryId ?? ""
                    }
                    onChange={(event) => {
                      setEditingId(selectedTransaction.id);
                      setEditCategoryId(event.target.value);
                    }}
                  >
                    <option value="">Choose a category</option>
                    {options.map(({ type, categories: typedCategories }) =>
                      typedCategories.length ? (
                        <optgroup key={type.id} label={type.name}>
                          {typedCategories.map((category) => (
                            <option key={category.id} value={category.id}>
                              {category.name}
                            </option>
                          ))}
                        </optgroup>
                      ) : null,
                    )}
                  </select>
                </div>
                <button
                  disabled={
                    saving ||
                    editingId !== selectedTransaction.id ||
                    !editCategoryId
                  }
                  type="button"
                  onClick={() => void changeCategory(selectedTransaction)}
                >
                  Save category
                </button>
              </div>
            </div>
          )}
        </section>
      </div>
    </section>
  );
}
