import { useEffect, useState, type FormEvent } from "react";
import { Check, CircleCheck } from "lucide-react";
import { api } from "../../lib/api";
import { money } from "../../lib/format";
import type {
  Account,
  Category,
  ExpenseType,
  ReviewTransaction,
} from "../../types/finance";

type CategorizationCardProps = {
  accounts: Account[];
  expenseTypes: ExpenseType[];
  categories: Category[];
  transactions: ReviewTransaction[];
  onChanged: () => Promise<void>;
};

export function CategorizationCard({
  accounts,
  expenseTypes,
  categories,
  transactions,
  onChanged,
}: CategorizationCardProps) {
  const transaction = transactions[0];
  const [categoryId, setCategoryId] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    setCategoryId(transaction?.suggestedCategoryId ?? "");
    setMessage("");
  }, [transaction?.id, transaction?.suggestedCategoryId]);

  async function categorize(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!transaction || !categoryId) return;
    setMessage("");
    try {
      await api.put(`/transactions/${transaction.id}/category`, { categoryId });
      await onChanged();
    } catch (reason) {
      setMessage(
        reason instanceof Error
          ? reason.message
          : "Unable to categorize this transaction.",
      );
    }
  }

  async function markTransfer() {
    if (!transaction) return;
    const destination = accounts.find(
      (account) =>
        account.id !== transaction.financialAccountId && account.isActive,
    );
    if (!destination) {
      setMessage("Add another active account before marking a transfer.");
      return;
    }
    setMessage("");
    try {
      await api.post(`/transactions/${transaction.id}/transfer`, {
        destinationAccountId: destination.id,
        destinationName: null,
      });
      await onChanged();
    } catch (reason) {
      setMessage(
        reason instanceof Error
          ? reason.message
          : "Unable to mark this transfer.",
      );
    }
  }

  if (!transaction)
    return (
      <section className="card flex min-h-80 flex-col items-center justify-center text-center">
        <CircleCheck className="mb-3 text-lime-400" size={42} />
        <h2 className="mb-1 text-xl">Your inbox is clear</h2>
        <p className="text-emerald-200">
          Import a CSV when you have more transactions to review.
        </p>
      </section>
    );
  const suggested = transaction.suggestedCategoryId
    ? categories.find(
        (category) => category.id === transaction.suggestedCategoryId,
      )?.name
    : undefined;

  return (
    <section className="card min-h-80">
      <div className="mb-8 flex items-center justify-between">
        <span className="rounded-full bg-emerald-900 px-3 py-1 text-sm text-emerald-100">
          {transactions.length} remaining
        </span>
        <span className="text-sm text-emerald-300">
          {transaction.transactionDate}
        </span>
      </div>
      <p className="mb-2 text-sm uppercase tracking-wider text-emerald-300">
        Transaction
      </p>
      <h2 className="mb-2 break-words text-2xl">{transaction.description}</h2>
      <strong
        className={
          transaction.amount < 0
            ? "text-3xl text-lime-300"
            : "text-3xl text-emerald-100"
        }
      >
        {money(transaction.amount)}
      </strong>
      <form
        className="mt-9 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]"
        onSubmit={categorize}
      >
        <div>
          <label
            className="mb-1 block text-sm font-medium text-emerald-100"
            htmlFor="category"
          >
            Category
          </label>
          <select
            id="category"
            value={categoryId}
            onChange={(event) => setCategoryId(event.target.value)}
          >
            <option value="">Choose a category</option>
            {expenseTypes.map((type) => {
              const typedCategories = categories.filter(
                (category) =>
                  category.expenseTypeId === type.id && !category.isArchived,
              );
              return typedCategories.length ? (
                <optgroup key={type.id} label={type.name}>
                  {typedCategories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </optgroup>
              ) : null;
            })}
          </select>
          {suggested && (
            <p className="mt-2 text-sm text-lime-300">
              Suggested from similar previous transactions: {suggested}
            </p>
          )}
        </div>
        <button className="self-end" disabled={!categoryId} type="submit">
          <Check className="mr-1 inline" size={17} />
          Confirm & next
        </button>
      </form>
      <button
        className="mt-4 bg-transparent text-emerald-200 hover:bg-emerald-900"
        type="button"
        onClick={markTransfer}
      >
        Mark as transfer
      </button>
      {message && (
        <p className="mt-3 text-sm text-red-300" role="alert">
          {message}
        </p>
      )}
    </section>
  );
}
