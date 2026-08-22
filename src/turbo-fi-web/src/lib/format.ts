export const money = (amount: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)

export const monthParams = (month: string) => `year=${month.slice(0, 4)}&month=${Number(month.slice(5, 7))}`

export const monthLabel = (month: string) => new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(new Date(`${month}-01T12:00:00`))

