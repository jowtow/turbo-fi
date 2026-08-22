import { useState, type FormEvent } from 'react'
import { Trash2 } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { PageHeading } from '../../components/PageHeading'
import { api } from '../../lib/api'
import { useFinanceReferenceData } from '../finance/useFinanceReferenceData'

export function SettingsWorkspace() {
  const queryClient = useQueryClient()
  const { expenseTypes, categories, phraseRules } = useFinanceReferenceData(true)
  const refresh = () => queryClient.invalidateQueries()

  const [phrase, setPhrase] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [message, setMessage] = useState('')

  async function addRule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmed = phrase.trim()
    if (!trimmed || !categoryId) return
    setMessage('')
    try {
      await api.post('/phrase-rules', { phrase: trimmed, categoryId })
      setPhrase('')
      setCategoryId('')
      await refresh()
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : 'Unable to add phrase rule.')
    }
  }

  async function deleteRule(id: string) {
    setMessage('')
    try {
      await api.delete(`/phrase-rules/${id}`)
      await refresh()
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : 'Unable to delete phrase rule.')
    }
  }

  const categoryName = (id: string) => categories.find(c => c.id === id)?.name ?? '—'

  return (
    <div className="workspace">
      <PageHeading
        eyebrow="Configuration"
        title="Settings"
        description="Manage household-wide configuration for Turbo Fi."
      />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <section className="card h-fit">
          <h2 className="mb-1 text-xl">Categorization phrase rules</h2>
          <p className="mb-6 text-sm text-emerald-200">
            When a transaction description contains a phrase (anywhere, case-insensitive), the mapped category
            is suggested automatically — taking priority over history-based suggestions.
          </p>

          <div className="mb-6">
            <h3 className="mb-3 text-sm font-medium text-emerald-100">Add a new rule</h3>
            <form className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]" onSubmit={addRule}>
              <div>
                <label className="mb-1 block text-xs font-medium text-emerald-300" htmlFor="rule-phrase">
                  Phrase
                </label>
                <input
                  id="rule-phrase"
                  value={phrase}
                  onChange={e => setPhrase(e.target.value)}
                  placeholder="e.g. NETFLIX"
                  maxLength={200}
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-emerald-300" htmlFor="rule-category">
                  Maps to category
                </label>
                <select
                  id="rule-category"
                  value={categoryId}
                  onChange={e => setCategoryId(e.target.value)}
                  required
                >
                  <option value="">Choose a category</option>
                  {expenseTypes.map(type => {
                    const typedCategories = categories.filter(c => c.expenseTypeId === type.id && !c.isArchived)
                    return typedCategories.length ? (
                      <optgroup key={type.id} label={type.name}>
                        {typedCategories.map(c => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </optgroup>
                    ) : null
                  })}
                </select>
              </div>
              <button className="self-end" type="submit" disabled={!phrase.trim() || !categoryId}>
                Add rule
              </button>
            </form>
            {message && <p className="mt-3 text-sm text-red-300" role="alert">{message}</p>}
          </div>

          {phraseRules.length === 0 ? (
            <p className="text-sm text-emerald-400">No phrase rules yet. Add one above to get started.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-emerald-800 text-left text-emerald-300">
                  <th className="pb-2 pr-6 font-medium">Phrase</th>
                  <th className="pb-2 pr-6 font-medium">Category</th>
                  <th className="pb-2 font-medium sr-only">Actions</th>
                </tr>
              </thead>
              <tbody>
                {phraseRules.map(rule => (
                  <tr key={rule.id} className="border-b border-emerald-900">
                    <td className="py-2 pr-6 font-mono text-lime-200">{rule.phrase}</td>
                    <td className="py-2 pr-6 text-emerald-100">{categoryName(rule.categoryId)}</td>
                    <td className="py-2 text-right">
                      <button
                        className="bg-transparent px-1 text-red-300 hover:bg-red-950"
                        aria-label={`Delete rule for ${rule.phrase}`}
                        onClick={() => deleteRule(rule.id)}
                      >
                        <Trash2 size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </div>
  )
}
