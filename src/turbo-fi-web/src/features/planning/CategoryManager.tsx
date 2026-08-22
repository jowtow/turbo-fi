import { useState, type FormEvent } from 'react'
import { Archive, ArchiveRestore, Pencil, Plus, Tags, Trash2 } from 'lucide-react'
import { api } from '../../lib/api'
import type { Account, Category, ExpenseType } from '../../types/finance'

type CategoryManagerProps = {
  accounts: Account[]
  expenseTypes: ExpenseType[]
  categories: Category[]
  onChanged: () => Promise<void>
}

export function CategoryManager({ accounts, expenseTypes, categories, onChanged }: CategoryManagerProps) {
  const [categoryName, setCategoryName] = useState('')
  const [expenseTypeId, setExpenseTypeId] = useState('')
  const [typeName, setTypeName] = useState('')
  const [accountName, setAccountName] = useState('')
  const [institution, setInstitution] = useState('')
  const [lastFour, setLastFour] = useState('')
  const [editingType, setEditingType] = useState<ExpenseType>()
  const [editingCategory, setEditingCategory] = useState<Category>()
  const [message, setMessage] = useState('')
  const typeNames = new Map(expenseTypes.map(type => [type.id, type.name]))

  async function addCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setMessage('')
    try {
      await api.post('/categories', { name: categoryName, expenseTypeId })
      setCategoryName('')
      await onChanged()
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : 'Unable to add the category.')
    }
  }

  async function addType(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setMessage('')
    try {
      await api.post('/expense-types', { name: typeName })
      setTypeName('')
      await onChanged()
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : 'Unable to add the expense type.')
    }
  }

  async function addAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setMessage('')
    try {
      await api.post('/accounts', { name: accountName, institution: institution || null, lastFour: lastFour || null })
      setAccountName('')
      setInstitution('')
      setLastFour('')
      await onChanged()
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : 'Unable to add the bank account.')
    }
  }

  async function updateType(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!editingType) return
    setMessage('')
    try {
      await api.put(`/expense-types/${editingType.id}`, { name: editingType.name })
      setEditingType(undefined)
      await onChanged()
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : 'Unable to update the expense type.')
    }
  }

  async function updateCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!editingCategory) return
    setMessage('')
    try {
      await api.put(`/categories/${editingCategory.id}`, { name: editingCategory.name, expenseTypeId: editingCategory.expenseTypeId, color: editingCategory.color, isArchived: editingCategory.isArchived })
      setEditingCategory(undefined)
      await onChanged()
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : 'Unable to update the category.')
    }
  }

  async function deleteType(type: ExpenseType) {
    if (!window.confirm(`Delete ${type.name}? It must not have categories.`)) return
    setMessage('')
    try {
      await api.delete(`/expense-types/${type.id}`)
      await onChanged()
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : 'Unable to delete the expense type.')
    }
  }

  async function deleteCategory(category: Category) {
    if (!window.confirm(`Delete ${category.name}? Its plan rows will be deleted and its transactions uncategorized.`)) return
    setMessage('')
    try {
      await api.delete(`/categories/${category.id}`)
      await onChanged()
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : 'Unable to delete the category.')
    }
  }

  async function toggleArchive(category: Category) {
    setMessage('')
    try {
      await api.put(`/categories/${category.id}`, { name: category.name, expenseTypeId: category.expenseTypeId, color: category.color, isArchived: !category.isArchived })
      await onChanged()
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : 'Unable to update the category.')
    }
  }

  return <section className="card h-fit"><Tags className="mb-3 text-lime-400" /><h2 className="mb-1 text-xl">Plan categories</h2><p className="mb-4 text-sm text-emerald-200">Organize category buckets beneath expense types.</p><form className="space-y-2" onSubmit={addCategory}><select required value={expenseTypeId} onChange={event => setExpenseTypeId(event.target.value)}><option value="">Expense type</option>{expenseTypes.map(type => <option key={type.id} value={type.id}>{type.name}</option>)}</select><input required value={categoryName} onChange={event => setCategoryName(event.target.value)} placeholder="Category name" /><button className="w-full" type="submit">Add category</button></form><div className="mt-5 border-t border-emerald-900 pt-4"><p className="mb-2 text-sm font-medium">Expense types</p><form className="flex gap-2" onSubmit={addType}><input required value={typeName} onChange={event => setTypeName(event.target.value)} placeholder="New type" /><button type="submit"><Plus size={17} /></button></form>{editingType && <form className="mt-2 flex gap-2" onSubmit={updateType}><input required value={editingType.name} onChange={event => setEditingType({ ...editingType, name: event.target.value })} /><button type="submit">Save</button><button type="button" className="bg-transparent" onClick={() => setEditingType(undefined)}>Cancel</button></form>}<ul className="mt-3 space-y-2">{expenseTypes.map(type => <li className="flex items-center justify-between gap-2 text-sm" key={type.id}><span>{type.name}</span><span className="flex"><button className="bg-transparent px-1 text-lime-300 hover:bg-emerald-900" aria-label={`Rename ${type.name}`} onClick={() => setEditingType(type)}><Pencil size={15} /></button><button className="bg-transparent px-1 text-red-300 hover:bg-red-950" aria-label={`Delete ${type.name}`} onClick={() => deleteType(type)}><Trash2 size={15} /></button></span></li>)}</ul></div>{editingCategory && <form className="mt-5 space-y-2 border-t border-emerald-900 pt-4" onSubmit={updateCategory}><p className="text-sm font-medium">Edit category</p><select required value={editingCategory.expenseTypeId} onChange={event => setEditingCategory({ ...editingCategory, expenseTypeId: event.target.value })}>{expenseTypes.map(type => <option key={type.id} value={type.id}>{type.name}</option>)}</select><input required value={editingCategory.name} onChange={event => setEditingCategory({ ...editingCategory, name: event.target.value })} /><button type="submit">Save category</button><button className="ml-2 bg-transparent" type="button" onClick={() => setEditingCategory(undefined)}>Cancel</button></form>}{message && <p className="mt-3 text-sm text-red-300" role="alert">{message}</p>}<ul className="mt-5 space-y-2">{categories.map(category => <li className="flex items-center justify-between gap-2 border-t border-emerald-900 pt-2 text-sm" key={category.id}><span>{category.name}<span className="ml-2 text-xs text-emerald-300">{typeNames.get(category.expenseTypeId)}</span>{category.isArchived && <span className="ml-2 text-xs text-amber-300">Archived</span>}</span><span className="flex"><button className="bg-transparent px-1 text-lime-300 hover:bg-emerald-900" aria-label={`Edit ${category.name}`} onClick={() => setEditingCategory(category)}><Pencil size={15} /></button><button className="bg-transparent px-1 text-lime-300 hover:bg-emerald-900" aria-label={`${category.isArchived ? 'Restore' : 'Archive'} ${category.name}`} onClick={() => toggleArchive(category)}>{category.isArchived ? <ArchiveRestore size={15} /> : <Archive size={15} />}</button><button className="bg-transparent px-1 text-red-300 hover:bg-red-950" aria-label={`Delete ${category.name}`} onClick={() => deleteCategory(category)}><Trash2 size={15} /></button></span></li>)}</ul><div className="mt-5 border-t border-emerald-900 pt-4"><p className="mb-2 text-sm font-medium">Bank accounts</p><form className="space-y-2" onSubmit={addAccount}><input required value={accountName} onChange={event => setAccountName(event.target.value)} placeholder="Account name" /><input value={institution} onChange={event => setInstitution(event.target.value)} placeholder="Institution (optional)" /><input value={lastFour} onChange={event => setLastFour(event.target.value)} maxLength={4} inputMode="numeric" placeholder="Last four (optional)" /><button className="w-full" type="submit">Add bank account</button></form><ul className="mt-3 space-y-1">{accounts.map(account => <li className="text-sm" key={account.id}>{account.name}{account.institution && <span className="text-emerald-300"> · {account.institution}</span>}{account.lastFour && <span className="text-emerald-300"> · ••••{account.lastFour}</span>}</li>)}</ul></div></section>
}
