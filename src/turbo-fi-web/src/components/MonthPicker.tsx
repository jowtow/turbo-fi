import { ChevronLeft, ChevronRight } from "lucide-react";

type MonthPickerProps = {
  month: string;
  onChange: (month: string) => void;
  allowFuture?: boolean;
};

export function MonthPicker({
  month,
  onChange,
  allowFuture = false,
}: MonthPickerProps) {
  const shift = (amount: number) => {
    const date = new Date(`${month}-01T12:00:00`);
    date.setMonth(date.getMonth() + amount);
    onChange(date.toISOString().slice(0, 7));
  };
  const current = new Date().toISOString().slice(0, 7);

  return (
    <div className="flex items-center gap-1">
      <button
        className="bg-emerald-900 px-2 text-lime-200 hover:bg-emerald-800"
        aria-label="Previous month"
        onClick={() => shift(-1)}
      >
        <ChevronLeft size={18} />
      </button>
      <label className="sr-only" htmlFor="month-picker">
        Month
      </label>
      <input
        className="w-40 py-1.5"
        id="month-picker"
        type="month"
        max={allowFuture ? undefined : current}
        value={month}
        onChange={(event) => onChange(event.target.value)}
      />
      <button
        disabled={!allowFuture && month >= current}
        className="bg-emerald-900 px-2 text-lime-200 hover:bg-emerald-800"
        aria-label="Next month"
        onClick={() => shift(1)}
      >
        <ChevronRight size={18} />
      </button>
    </div>
  );
}
