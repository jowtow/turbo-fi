import { ArrowDown, ArrowUp, ChevronsUpDown, X } from 'lucide-react'

export type TableFilter = {
  id: string
  label: string
  value: string
  options: { label: string; value: string }[]
  onChange: (value: string) => void
}

type TableControlsProps = {
  searchLabel: string
  searchValue: string
  onSearchChange: (value: string) => void
  filters: TableFilter[]
  onClear: () => void
  hasFilters: boolean
}

export function TableControls({ searchLabel, searchValue, onSearchChange, filters, onClear, hasFilters }: TableControlsProps) {
  return <div className="mb-5 flex flex-wrap items-end gap-3">
    <label className="min-w-56 flex-1 text-sm text-emerald-200">
      <span className="mb-1 block">{searchLabel}</span>
      <input type="search" value={searchValue} onChange={event => onSearchChange(event.target.value)} />
    </label>
    {filters.map(filter => <label className="min-w-40 text-sm text-emerald-200" key={filter.id}>
      <span className="mb-1 block">{filter.label}</span>
      <select className="w-full" value={filter.value} onChange={event => filter.onChange(event.target.value)}>
        {filter.options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </label>)}
    {hasFilters && <button className="bg-emerald-900 text-lime-200 hover:bg-emerald-800" type="button" onClick={onClear}><X className="mr-1 inline" size={16} />Clear</button>}
  </div>
}

export type SortDirection = 'asc' | 'desc'

type SortableHeaderProps = {
  direction?: SortDirection
  label: string
  onSort: () => void
}

export function SortableHeader({ direction, label, onSort }: SortableHeaderProps) {
  const Icon = direction === 'asc' ? ArrowUp : direction === 'desc' ? ArrowDown : ChevronsUpDown

  return <button className="inline-flex items-center gap-1 bg-transparent p-0 text-inherit hover:bg-transparent hover:text-lime-300" type="button" onClick={onSort} aria-label={`Sort by ${label}${direction ? `, currently ${direction === 'asc' ? 'ascending' : 'descending'}` : ''}`}>
    {label}<Icon size={14} aria-hidden="true" />
  </button>
}
