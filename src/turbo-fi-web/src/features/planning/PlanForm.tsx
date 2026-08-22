import { useState, type FormEvent } from 'react'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { api } from '../../lib/api'
import { money, monthLabel } from '../../lib/format'
import type { Category, ExpenseType, PlannedEntry } from '../../types/finance'

type PlanFormProps = {
  expenseTypes: ExpenseType[]
  categories: Category[]
  entries: PlannedEntry[]
  month: string
  onChanged: () => Promise<void>
}

export function PlanForm({ expenseTypes, categories, entries, month, onChanged }: PlanFormProps) {
  const [message, setMessage] = useState('')
  const [editingPlan, setEditingPlan] = useState<PlannedEntry>()
  const [editingCategoryName, setEditingCategoryName] = useState('')
  const [editingExpenseTypeId, setEditingExpenseTypeId] = useState('')
  const categoryNames = new Map(categories.map(category => [category.id, category.name]))
  const typeNames = new Map(expenseTypes.map(type => [type.id, type.name]))
  const plannedIds = new Set(entries.map(entry => entry.categoryId))
  const available = categories.filter(category => !category.isArchived && !plannedIds.has(category.id))
  const orderedEntries = [...entries].sort((left, right) => {
    const leftType = typeNames.get(categories.find(category => category.id === left.categoryId)?.expenseTypeId ?? '') ?? ''
    const rightType = typeNames.get(categories.find(category => category.id === right.categoryId)?.expenseTypeId ?? '') ?? ''
    return leftType.localeCompare(rightType) || right.amount - left.amount || (categoryNames.get(left.categoryId) ?? '').localeCompare(categoryNames.get(right.categoryId) ?? '')
  })

  async function addPlan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)
    setMessage('')
    try {
      await api.post('/planned-entries', { categoryId: String(data.get('categoryId')), amount: Number(data.get('amount')), year: Number(month.slice(0, 4)), month: Number(month.slice(5, 7)), isFixed: data.get('isFixed') === 'on' })
      form.reset()
      await onChanged()
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : 'Unable to add the plan.')
    }
  }

  async function removePlan(entry: PlannedEntry) {
    setMessage('')
    try {
      await api.delete(`/planned-entries/${entry.id}`)
      await onChanged()
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : 'Unable to remove the plan.')
    }
  }

  async function updatePlan() {
    if (!editingPlan) return
    const category = categories.find(item => item.id === editingPlan.categoryId)
    if (!category) {
      setMessage('The category for this plan could not be found.')
      return
    }
    setMessage('')
    try {
      await api.put(`/categories/${category.id}`, { name: editingCategoryName, expenseTypeId: editingExpenseTypeId, color: category.color, isArchived: category.isArchived })
      await api.put(`/planned-entries/${editingPlan.id}`, { amount: editingPlan.amount, isFixed: editingPlan.isFixed })
      setEditingPlan(undefined)
      await onChanged()
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : 'Unable to update the plan.')
    }
  }

  return <section className="card"><div className="mb-5 flex justify-between gap-4"><div><h2 className="mb-1 text-xl">{monthLabel(month)}</h2><p className="text-sm text-emerald-200">{entries.length ? 'Copied values remain independent for this month.' : 'Add a category budget to begin this month’s plan.'}</p></div><span className="rounded-full bg-lime-950 px-3 py-1 text-sm text-lime-300">{entries.length} categories</span></div>
    <form className="grid gap-3 md:grid-cols-3" onSubmit={addPlan}><select required disabled={!available.length} name="categoryId" defaultValue=""><option value="">Add category</option>{expenseTypes.map(type => { const typedCategories = available.filter(category => category.expenseTypeId === type.id); return typedCategories.length ? <optgroup key={type.id} label={type.name}>{typedCategories.map(category => <option key={category.id} value={category.id}>{category.name}</option>)}</optgroup> : null })}</select><input required disabled={!available.length} name="amount" type="number" min="0.01" step="0.01" placeholder="Monthly amount" /><button disabled={!available.length} type="submit"><Plus className="mr-1 inline" size={17} />Add</button><label className="flex items-center gap-2 text-sm text-emerald-100 md:col-span-3"><input className="h-4 w-4" disabled={!available.length} name="isFixed" type="checkbox" />Fixed known payment</label></form>
    {message && <p className="mt-3 text-sm text-red-300" role="alert">{message}</p>}
    <div className="mt-6 overflow-x-auto"><table><thead><tr><th>Category</th><th>Expense type</th><th>Amount</th><th>Plan type</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>{orderedEntries.map(entry => { const editing = editingPlan?.id === entry.id; const category = categories.find(item => item.id === entry.categoryId); return <tr key={entry.id}><td className="font-medium">{editing ? <input aria-label="Category name" value={editingCategoryName} onChange={event => setEditingCategoryName(event.target.value)} /> : categoryNames.get(entry.categoryId) ?? 'Unknown category'}</td><td>{editing ? <select aria-label="Expense type" value={editingExpenseTypeId} onChange={event => setEditingExpenseTypeId(event.target.value)}>{expenseTypes.map(type => <option key={type.id} value={type.id}>{type.name}</option>)}</select> : category ? typeNames.get(category.expenseTypeId) ?? 'Unknown type' : 'Uncategorized'}</td><td>{editing ? <input aria-label="Monthly amount" className="w-28" type="number" min="0.01" step="0.01" value={editingPlan.amount} onChange={event => setEditingPlan({ ...editingPlan, amount: Number(event.target.value) })} /> : money(entry.amount)}</td><td>{editing ? <label className="flex items-center gap-2 text-sm"><input className="h-4 w-4" type="checkbox" checked={editingPlan.isFixed} onChange={event => setEditingPlan({ ...editingPlan, isFixed: event.target.checked })} />Fixed</label> : <span className={`rounded-full px-2 py-1 text-xs ${entry.isFixed ? 'bg-lime-950 text-lime-300' : 'bg-emerald-900 text-emerald-200'}`}>{entry.isFixed ? 'Fixed' : 'Target'}</span>}</td><td className="text-right">{editing ? <><button className="bg-transparent px-2 text-lime-300 hover:bg-emerald-900" aria-label={`Save ${categoryNames.get(entry.categoryId) ?? 'plan'}`} onClick={updatePlan}>Save</button><button className="bg-transparent px-2 text-emerald-200 hover:bg-emerald-900" onClick={() => setEditingPlan(undefined)}>Cancel</button></> : <><button className="bg-transparent px-2 text-lime-300 hover:bg-emerald-900" aria-label={`Edit ${categoryNames.get(entry.categoryId) ?? 'plan'}`} onClick={() => { setEditingPlan(entry); setEditingCategoryName(category?.name ?? ''); setEditingExpenseTypeId(category?.expenseTypeId ?? '') }}><Pencil size={17} /></button><button className="bg-transparent px-2 text-red-300 hover:bg-red-950" aria-label={`Remove ${categoryNames.get(entry.categoryId) ?? 'plan'}`} onClick={() => removePlan(entry)}><Trash2 size={17} /></button></>}</td></tr>})}</tbody></table>{!entries.length && <p className="py-5 text-sm text-emerald-200">No planned expenses for this month yet.</p>}</div>
  </section>
}
