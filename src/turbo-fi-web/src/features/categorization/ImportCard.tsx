import { useState, type FormEvent } from 'react'
import { FileUp } from 'lucide-react'
import { api } from '../../lib/api'
import { money } from '../../lib/format'
import type { Account, ImportConflict } from '../../types/finance'

type ImportCardProps = { accounts: Account[]; onImported: () => void }

export function ImportCard({ accounts, onImported }: ImportCardProps) {
  const [file, setFile] = useState<File>()
  const [accountId, setAccountId] = useState('')
  const [message, setMessage] = useState('')
  const [conflicts, setConflicts] = useState<ImportConflict[]>([])
  const [descriptions, setDescriptions] = useState<Record<number, string>>({})
  const canContinue = conflicts.every(conflict => {
    const description = descriptions[conflict.index]?.trim()
    return description && description !== conflict.description
  })

  async function submitImport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!file || !accountId) return
    setMessage('')
    const form = new FormData()
    form.append('file', file)
    form.append('accountId', accountId)
    if (Object.keys(descriptions).length) form.append('descriptionOverrides', JSON.stringify(descriptions))
    try {
      const result = await api.form('/imports/wells-fargo', form)
      if (result.conflicts?.length) {
        setConflicts(result.conflicts)
        setDescriptions(current => Object.fromEntries(result.conflicts!.map(conflict => [conflict.index, current[conflict.index] ?? conflict.description])))
        setMessage('Update each matching description, then continue the import.')
        return
      }
      setConflicts([])
      setDescriptions({})
      setMessage(`${result.imported ?? 0} transactions imported for review.`)
      onImported()
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : 'Import failed.')
    }
  }

  return <section className="card h-fit"><FileUp className="mb-3 text-lime-400" size={24} /><h2 className="mb-1 text-xl">Import CSV</h2><p className="mb-4 text-sm text-emerald-200">Import a Wells Fargo CSV directly into this review queue.</p><form className="space-y-3" onSubmit={submitImport}><select required value={accountId} disabled={conflicts.length > 0} onChange={event => setAccountId(event.target.value)}><option value="">Choose account</option>{accounts.map(account => <option key={account.id} value={account.id}>{account.name}</option>)}</select><input required type="file" accept=".csv,text/csv" disabled={conflicts.length > 0} onChange={event => { setFile(event.target.files?.[0]); setConflicts([]); setDescriptions({}); setMessage('') }} />{conflicts.map(conflict => <div className="space-y-1 rounded-md bg-amber-950 p-3" key={conflict.index}><p className="text-xs text-amber-200">{conflict.transactionDate} · {money(conflict.amount)}</p><input required value={descriptions[conflict.index] ?? conflict.description} onChange={event => setDescriptions(current => ({ ...current, [conflict.index]: event.target.value }))} /></div>)}<button className="w-full" disabled={conflicts.length > 0 && !canContinue} type="submit">{conflicts.length ? 'Continue import' : 'Import for review'}</button>{message && <p className="text-sm text-emerald-100" role="status">{message}</p>}</form></section>
}
