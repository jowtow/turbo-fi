import { useState, type FormEvent } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Pencil, Trash2 } from 'lucide-react'
import { api } from '../../lib/api'
import type { ImportScheme } from '../../types/finance'

type SchemeForm = {
  name: string
  dateColumn: string
  descriptionColumn: string
  amountColumn: string
  checkNumberColumn: string
  statusColumn: string
  dateFormat: string
  invertAmount: boolean
  skipHeaderRows: string
  requiredHeaders: string
}

const emptyForm: SchemeForm = {
  name: '',
  dateColumn: '',
  descriptionColumn: '',
  amountColumn: '',
  checkNumberColumn: '',
  statusColumn: '',
  dateFormat: 'M/d/yyyy',
  invertAmount: false,
  skipHeaderRows: '0',
  requiredHeaders: '',
}

function toForm(scheme: ImportScheme): SchemeForm {
  return {
    name: scheme.name,
    dateColumn: scheme.dateColumn,
    descriptionColumn: scheme.descriptionColumn,
    amountColumn: scheme.amountColumn,
    checkNumberColumn: scheme.checkNumberColumn ?? '',
    statusColumn: scheme.statusColumn ?? '',
    dateFormat: scheme.dateFormat,
    invertAmount: scheme.invertAmount,
    skipHeaderRows: String(scheme.skipHeaderRows),
    requiredHeaders: scheme.requiredHeaders?.join(', ') ?? '',
  }
}

export function ImportSchemeEditor() {
  const queryClient = useQueryClient()
  const schemes = useQuery({ queryKey: ['import-schemes'], queryFn: () => api.get('/import-schemes') })
  const [form, setForm] = useState<SchemeForm>(emptyForm)
  const [editingId, setEditingId] = useState<string>()
  const [message, setMessage] = useState('')

  const setField = <Field extends keyof SchemeForm>(field: Field, value: SchemeForm[Field]) =>
    setForm(current => ({ ...current, [field]: value }))

  function resetForm() {
    setForm(emptyForm)
    setEditingId(undefined)
  }

  async function saveScheme(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setMessage('')
    const requiredHeaders = form.requiredHeaders
      .split(',')
      .map(header => header.trim())
      .filter(Boolean)
    const request = {
      name: form.name.trim(),
      dateColumn: form.dateColumn.trim(),
      descriptionColumn: form.descriptionColumn.trim(),
      amountColumn: form.amountColumn.trim(),
      checkNumberColumn: form.checkNumberColumn.trim() || null,
      statusColumn: form.statusColumn.trim() || null,
      dateFormat: form.dateFormat.trim(),
      invertAmount: form.invertAmount,
      skipHeaderRows: Math.max(0, Number.parseInt(form.skipHeaderRows, 10) || 0),
      requiredHeaders: requiredHeaders.length ? requiredHeaders : null,
    }

    try {
      if (editingId) {
        await api.put(`/import-schemes/${editingId}`, request)
        setMessage('Import scheme updated.')
      } else {
        await api.post('/import-schemes', request)
        setMessage('Import scheme created.')
      }
      resetForm()
      await queryClient.invalidateQueries({ queryKey: ['import-schemes'] })
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : 'Unable to save import scheme.')
    }
  }

  async function deleteScheme(scheme: ImportScheme) {
    setMessage('')
    try {
      await api.delete(`/import-schemes/${scheme.id}`)
      if (editingId === scheme.id) resetForm()
      await queryClient.invalidateQueries({ queryKey: ['import-schemes'] })
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : 'Unable to delete import scheme.')
    }
  }

  return (
    <section className="card xl:col-span-2">
      <h2 className="mb-1 text-xl">Import schemes</h2>
      <p className="mb-6 text-sm text-emerald-200">
        Map your bank&apos;s CSV headers to the transaction fields Turbo Fi imports. Built-in schemes are read-only;
        custom schemes are shared with your household.
      </p>

      <form className="grid gap-3 md:grid-cols-2" onSubmit={saveScheme}>
        <label className="text-sm text-emerald-100">Scheme name
          <input required value={form.name} onChange={event => setField('name', event.target.value)} placeholder="e.g. My credit union" />
        </label>
        <label className="text-sm text-emerald-100">Date format
          <input required value={form.dateFormat} onChange={event => setField('dateFormat', event.target.value)} placeholder="M/d/yyyy" />
        </label>
        <label className="text-sm text-emerald-100">Date column
          <input required value={form.dateColumn} onChange={event => setField('dateColumn', event.target.value)} placeholder="e.g. Date" />
        </label>
        <label className="text-sm text-emerald-100">Description column
          <input required value={form.descriptionColumn} onChange={event => setField('descriptionColumn', event.target.value)} placeholder="e.g. Description" />
        </label>
        <label className="text-sm text-emerald-100">Amount column
          <input required value={form.amountColumn} onChange={event => setField('amountColumn', event.target.value)} placeholder="e.g. Amount" />
        </label>
        <label className="text-sm text-emerald-100">Check number column (optional)
          <input value={form.checkNumberColumn} onChange={event => setField('checkNumberColumn', event.target.value)} placeholder="e.g. Check #" />
        </label>
        <label className="text-sm text-emerald-100">Status column (optional)
          <input value={form.statusColumn} onChange={event => setField('statusColumn', event.target.value)} placeholder="e.g. Status" />
        </label>
        <label className="text-sm text-emerald-100">Rows before header
          <input min="0" type="number" value={form.skipHeaderRows} onChange={event => setField('skipHeaderRows', event.target.value)} />
        </label>
        <label className="md:col-span-2 text-sm text-emerald-100">Required headers (optional, comma-separated)
          <input value={form.requiredHeaders} onChange={event => setField('requiredHeaders', event.target.value)} placeholder="e.g. Account, Date, Description, Amount" />
        </label>
        <label className="flex items-center gap-2 text-sm text-emerald-100">
          <input checked={form.invertAmount} type="checkbox" onChange={event => setField('invertAmount', event.target.checked)} />
          Reverse amount signs
        </label>
        <div className="flex items-end gap-2">
          <button type="submit">{editingId ? 'Save changes' : 'Create scheme'}</button>
          {editingId && <button className="bg-transparent text-emerald-200 hover:bg-emerald-900" type="button" onClick={resetForm}>Cancel</button>}
        </div>
      </form>
      {message && <p className="mt-3 text-sm text-emerald-100" role="status">{message}</p>}

      <div className="mt-8 overflow-x-auto">
        {schemes.isLoading ? <p className="text-sm text-emerald-400">Loading import schemes...</p>
          : schemes.isError ? <p className="text-sm text-red-300" role="alert">Unable to load import schemes.</p>
            : schemes.data?.length === 0 ? <p className="text-sm text-emerald-400">No import schemes yet.</p>
              : <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-emerald-800 text-left text-emerald-300">
                    <th className="pb-2 pr-6 font-medium">Name</th>
                    <th className="pb-2 pr-6 font-medium">Mapping</th>
                    <th className="pb-2 font-medium sr-only">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {schemes.data?.map(scheme => (
                    <tr key={scheme.id} className="border-b border-emerald-900">
                      <td className="py-2 pr-6 text-emerald-100">
                        {scheme.name} {scheme.isGlobal && <span className="text-xs text-emerald-400">(built-in)</span>}
                      </td>
                      <td className="py-2 pr-6 font-mono text-xs text-emerald-300">
                        {scheme.dateColumn} / {scheme.descriptionColumn} / {scheme.amountColumn}
                      </td>
                      <td className="py-2 text-right">
                        {!scheme.isGlobal && <>
                          <button className="mr-2 bg-transparent px-1 text-emerald-200 hover:bg-emerald-900" aria-label={`Edit ${scheme.name}`} onClick={() => { setForm(toForm(scheme)); setEditingId(scheme.id); setMessage('') }}>
                            <Pencil size={15} />
                          </button>
                          <button className="bg-transparent px-1 text-red-300 hover:bg-red-950" aria-label={`Delete ${scheme.name}`} onClick={() => deleteScheme(scheme)}>
                            <Trash2 size={15} />
                          </button>
                        </>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>}
      </div>
    </section>
  )
}
