import { useEffect, useState, type FormEvent } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { api } from "../../lib/api";
import { SortableHeader, type SortDirection, TableControls } from "../../components/TableControls";
import { money, monthLabel } from "../../lib/format";
import type { Category, ExpenseType, PlannedEntry } from "../../types/finance";

type PlanFormProps = {
  expenseTypes: ExpenseType[];
  categories: Category[];
  entries: PlannedEntry[];
  month: string;
  onChanged: () => Promise<void>;
};

type PlanRow = {
  entry: PlannedEntry;
  category?: Category;
  categoryName: string;
  expenseTypeName: string;
  planType: "Fixed" | "Target";
};

type PlanSortColumn = "category" | "expenseType" | "amount" | "planType";
type PlanSorting = { column: PlanSortColumn; direction: SortDirection };

export function PlanForm({
  expenseTypes,
  categories,
  entries,
  month,
  onChanged,
}: PlanFormProps) {
  const [message, setMessage] = useState("");
  const [editingPlan, setEditingPlan] = useState<PlannedEntry>();
  const [editingCategoryName, setEditingCategoryName] = useState("");
  const [editingExpenseTypeId, setEditingExpenseTypeId] = useState("");
  const [search, setSearch] = useState("");
  const [expenseTypeFilter, setExpenseTypeFilter] = useState("");
  const [planTypeFilter, setPlanTypeFilter] = useState("");
  const [sorting, setSorting] = useState<PlanSorting>();
  const categoryNames = new Map(
    categories.map((category) => [category.id, category.name]),
  );
  const typeNames = new Map(expenseTypes.map((type) => [type.id, type.name]));
  const plannedIds = new Set(entries.map((entry) => entry.categoryId));
  const available = categories.filter(
    (category) => !category.isArchived && !plannedIds.has(category.id),
  );
  const orderedEntries = [...entries].sort((left, right) => {
    const leftType =
      typeNames.get(
        categories.find((category) => category.id === left.categoryId)
          ?.expenseTypeId ?? "",
      ) ?? "";
    const rightType =
      typeNames.get(
        categories.find((category) => category.id === right.categoryId)
          ?.expenseTypeId ?? "",
      ) ?? "";
    return (
      leftType.localeCompare(rightType) ||
      right.amount - left.amount ||
      (categoryNames.get(left.categoryId) ?? "").localeCompare(
        categoryNames.get(right.categoryId) ?? "",
      )
    );
  });
  const rows: PlanRow[] = orderedEntries
    .map((entry) => {
      const category = categories.find((item) => item.id === entry.categoryId);
      const planType: PlanRow["planType"] = entry.isFixed ? "Fixed" : "Target";
      return {
        entry,
        category,
        categoryName: categoryNames.get(entry.categoryId) ?? "Unknown category",
        expenseTypeName: category
          ? (typeNames.get(category.expenseTypeId) ?? "Unknown type")
          : "Uncategorized",
        planType,
      };
    })
    .filter((row) => {
      const query = search.trim().toLocaleLowerCase();
      return (
        (!query || row.categoryName.toLocaleLowerCase().includes(query)) &&
        (!expenseTypeFilter ||
          row.category?.expenseTypeId === expenseTypeFilter) &&
        (!planTypeFilter || row.planType === planTypeFilter)
      );
    });
  const sortedRows = sorting
    ? [...rows].sort((left, right) => {
        const comparison =
          sorting.column === "amount"
            ? left.entry.amount - right.entry.amount
            : (sorting.column === "category"
                  ? left.categoryName
                  : sorting.column === "expenseType"
                    ? left.expenseTypeName
                    : left.planType
                ).localeCompare(
                  sorting.column === "category"
                    ? right.categoryName
                    : sorting.column === "expenseType"
                      ? right.expenseTypeName
                      : right.planType,
                );
        return sorting.direction === "asc" ? comparison : -comparison;
      })
    : rows;

  useEffect(() => {
    setSearch("");
    setExpenseTypeFilter("");
    setPlanTypeFilter("");
    setSorting(undefined);
  }, [month]);

  function clearTableControls() {
    setSearch("");
    setExpenseTypeFilter("");
    setPlanTypeFilter("");
    setSorting(undefined);
  }

  function toggleSort(column: PlanSortColumn) {
    setSorting((current) =>
      current?.column === column
        ? current.direction === "asc"
          ? { column, direction: "desc" }
          : undefined
        : { column, direction: "asc" },
    );
  }

  async function addPlan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setMessage("");
    try {
      await api.post("/planned-entries", {
        categoryId: String(data.get("categoryId")),
        amount: Number(data.get("amount")),
        year: Number(month.slice(0, 4)),
        month: Number(month.slice(5, 7)),
        isFixed: data.get("isFixed") === "on",
      });
      form.reset();
      await onChanged();
    } catch (reason) {
      setMessage(
        reason instanceof Error ? reason.message : "Unable to add the plan.",
      );
    }
  }

  async function removePlan(entry: PlannedEntry) {
    setMessage("");
    try {
      await api.delete(`/planned-entries/${entry.id}`);
      await onChanged();
    } catch (reason) {
      setMessage(
        reason instanceof Error ? reason.message : "Unable to remove the plan.",
      );
    }
  }

  async function updatePlan() {
    if (!editingPlan) return;
    const category = categories.find(
      (item) => item.id === editingPlan.categoryId,
    );
    if (!category) {
      setMessage("The category for this plan could not be found.");
      return;
    }
    setMessage("");
    try {
      await api.put(`/categories/${category.id}`, {
        name: editingCategoryName,
        expenseTypeId: editingExpenseTypeId,
        color: category.color,
        isArchived: category.isArchived,
      });
      await api.put(`/planned-entries/${editingPlan.id}`, {
        amount: editingPlan.amount,
        isFixed: editingPlan.isFixed,
      });
      setEditingPlan(undefined);
      await onChanged();
    } catch (reason) {
      setMessage(
        reason instanceof Error ? reason.message : "Unable to update the plan.",
      );
    }
  }

  return (
    <section className="card">
      <div className="mb-5 flex justify-between gap-4">
        <div>
          <h2 className="mb-1 text-xl">{monthLabel(month)}</h2>
          <p className="text-sm text-emerald-200">
            {entries.length
              ? "Copied values remain independent for this month."
              : "Add a category budget to begin this month’s plan."}
          </p>
        </div>
        <span className="rounded-full bg-lime-950 px-3 py-1 text-sm text-lime-300">
          {entries.length} categories
        </span>
      </div>
      <form className="grid gap-3 md:grid-cols-3" onSubmit={addPlan}>
        <select
          required
          disabled={!available.length}
          name="categoryId"
          defaultValue=""
        >
          <option value="">Add category</option>
          {expenseTypes.map((type) => {
            const typedCategories = available.filter(
              (category) => category.expenseTypeId === type.id,
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
        <input
          required
          disabled={!available.length}
          name="amount"
          type="number"
          min="0.01"
          step="0.01"
          placeholder="Monthly amount"
        />
        <button disabled={!available.length} type="submit">
          <Plus className="mr-1 inline" size={17} />
          Add
        </button>
        <label className="flex items-center gap-2 text-sm text-emerald-100 md:col-span-3">
          <input
            className="h-4 w-4"
            disabled={!available.length}
            name="isFixed"
            type="checkbox"
          />
          Fixed known payment
        </label>
      </form>
      {message && (
        <p className="mt-3 text-sm text-red-300" role="alert">
          {message}
        </p>
      )}
      <div className="mt-6">
        <TableControls
          searchLabel="Search categories"
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
                  value: type.id,
                })),
              ],
            },
            {
              id: "plan-type",
              label: "Plan type",
              value: planTypeFilter,
              onChange: setPlanTypeFilter,
              options: [
                { label: "All plan types", value: "" },
                { label: "Fixed", value: "Fixed" },
                { label: "Target", value: "Target" },
              ],
            },
          ]}
          onClear={clearTableControls}
          hasFilters={Boolean(
            search || expenseTypeFilter || planTypeFilter || sorting,
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
                  <SortableHeader direction={sorting?.column === "expenseType" ? sorting.direction : undefined} label="Expense type" onSort={() => toggleSort("expenseType")} />
                </th>
                <th>
                  <SortableHeader direction={sorting?.column === "amount" ? sorting.direction : undefined} label="Amount" onSort={() => toggleSort("amount")} />
                </th>
                <th>
                  <SortableHeader direction={sorting?.column === "planType" ? sorting.direction : undefined} label="Plan type" onSort={() => toggleSort("planType")} />
                </th>
                <th>
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedRows.map(({ entry, category, categoryName, expenseTypeName }) => {
                const editing = editingPlan?.id === entry.id;
                return (
                  <tr key={entry.id}>
                    <td className="font-medium">
                      {editing ? (
                        <input
                          aria-label="Category name"
                          value={editingCategoryName}
                          onChange={(event) =>
                            setEditingCategoryName(event.target.value)
                          }
                        />
                      ) : (
                        categoryName
                      )}
                    </td>
                    <td>
                      {editing ? (
                        <select
                          aria-label="Expense type"
                          value={editingExpenseTypeId}
                          onChange={(event) =>
                            setEditingExpenseTypeId(event.target.value)
                          }
                        >
                          {expenseTypes.map((type) => (
                            <option key={type.id} value={type.id}>
                              {type.name}
                            </option>
                          ))}
                        </select>
                      ) : (
                        expenseTypeName
                      )}
                    </td>
                    <td>
                      {editing ? (
                        <input
                          aria-label="Monthly amount"
                          className="w-28"
                          type="number"
                          min="0.01"
                          step="0.01"
                          value={editingPlan.amount}
                          onChange={(event) =>
                            setEditingPlan({
                              ...editingPlan,
                              amount: Number(event.target.value),
                            })
                          }
                        />
                      ) : (
                        money(entry.amount)
                      )}
                    </td>
                    <td>
                      {editing ? (
                        <label className="flex items-center gap-2 text-sm">
                          <input
                            className="h-4 w-4"
                            type="checkbox"
                            checked={editingPlan.isFixed}
                            onChange={(event) =>
                              setEditingPlan({
                                ...editingPlan,
                                isFixed: event.target.checked,
                              })
                            }
                          />
                          Fixed
                        </label>
                      ) : (
                        <span
                          className={`rounded-full px-2 py-1 text-xs ${entry.isFixed ? "bg-lime-950 text-lime-300" : "bg-emerald-900 text-emerald-200"}`}
                        >
                          {entry.isFixed ? "Fixed" : "Target"}
                        </span>
                      )}
                    </td>
                    <td className="text-right">
                      {editing ? (
                        <>
                          <button
                            className="bg-transparent px-2 text-lime-300 hover:bg-emerald-900"
                            aria-label={`Save ${categoryName}`}
                            onClick={updatePlan}
                          >
                            Save
                          </button>
                          <button
                            className="bg-transparent px-2 text-emerald-200 hover:bg-emerald-900"
                            onClick={() => setEditingPlan(undefined)}
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            className="bg-transparent px-2 text-lime-300 hover:bg-emerald-900"
                            aria-label={`Edit ${categoryName}`}
                            onClick={() => {
                              setEditingPlan(entry);
                              setEditingCategoryName(category?.name ?? "");
                              setEditingExpenseTypeId(
                                category?.expenseTypeId ?? "",
                              );
                            }}
                          >
                            <Pencil size={17} />
                          </button>
                          <button
                            className="bg-transparent px-2 text-red-300 hover:bg-red-950"
                            aria-label={`Remove ${categoryName}`}
                            onClick={() => removePlan(entry)}
                          >
                            <Trash2 size={17} />
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!rows.length && (
            <p className="py-5 text-sm text-emerald-200">
              {entries.length
                ? "No planned expenses match these filters."
                : "No planned expenses for this month yet."}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
