import type {
  Account,
  Category,
  Dashboard,
  ExpenseType,
  ImportResult,
  PlannedEntry,
  ReviewTransaction,
} from '../types/finance'

export type CurrentUser = { email: string; householdName: string }

type Credentials = { email: string; password: string }
type RegisterRequest = Credentials & { householdName: string }
type AccountRequest = { name: string; institution: string | null; lastFour: string | null }
type ExpenseTypeRequest = { name: string }
type CategoryRequest = { name: string; expenseTypeId: string; color?: string; isArchived?: boolean }
type PlannedEntryRequest = { categoryId: string; amount: number; year: number; month: number; isFixed: boolean }
type PlannedEntryUpdateRequest = { amount: number; isFixed: boolean }
type CategorizeTransactionRequest = { categoryId: string }
type MarkTransferRequest = { destinationAccountId: string; destinationName: null }

export type GetPath =
  | '/auth/me'
  | '/accounts'
  | '/expense-types'
  | '/categories'
  | '/transactions/review'
  | `/dashboard?${string}`
  | `/planned-entries?${string}`

export type PostPath =
  | '/auth/register'
  | '/auth/login'
  | '/auth/logout'
  | '/accounts'
  | '/expense-types'
  | '/categories'
  | '/planned-entries'
  | `/transactions/${string}/transfer`

export type PutPath =
  | `/transactions/${string}/category`
  | `/expense-types/${string}`
  | `/categories/${string}`
  | `/planned-entries/${string}`

export type DeletePath =
  | `/expense-types/${string}`
  | `/categories/${string}`
  | `/planned-entries/${string}`

export type FormPath = '/imports/wells-fargo'

export type GetResponse<Path extends GetPath> =
  Path extends '/auth/me' ? CurrentUser
    : Path extends '/accounts' ? Account[]
      : Path extends '/expense-types' ? ExpenseType[]
        : Path extends '/categories' ? Category[]
          : Path extends '/transactions/review' ? ReviewTransaction[]
            : Path extends `/dashboard?${string}` ? Dashboard
              : Path extends `/planned-entries?${string}` ? PlannedEntry[]
                : never

export type PostBody<Path extends PostPath> =
  Path extends '/auth/register' ? RegisterRequest
    : Path extends '/auth/login' ? Credentials
      : Path extends '/auth/logout' ? undefined
        : Path extends '/accounts' ? AccountRequest
          : Path extends '/expense-types' ? ExpenseTypeRequest
            : Path extends '/categories' ? CategoryRequest
              : Path extends '/planned-entries' ? PlannedEntryRequest
                : Path extends `/transactions/${string}/transfer` ? MarkTransferRequest
                  : never

export type PostResponse<Path extends PostPath> =
  Path extends '/accounts' ? Account
    : Path extends '/expense-types' ? ExpenseType
      : Path extends '/categories' ? Category
        : Path extends '/planned-entries' ? PlannedEntry
          : void

export type PutBody<Path extends PutPath> =
  Path extends `/transactions/${string}/category` ? CategorizeTransactionRequest
    : Path extends `/expense-types/${string}` ? ExpenseTypeRequest
      : Path extends `/categories/${string}` ? CategoryRequest
        : Path extends `/planned-entries/${string}` ? PlannedEntryUpdateRequest
          : never

export type PutResponse<Path extends PutPath> =
  Path extends `/expense-types/${string}` ? ExpenseType
    : Path extends `/categories/${string}` ? Category
      : Path extends `/planned-entries/${string}` ? PlannedEntry
        : void

export type DeleteResponse<Path extends DeletePath> = Path extends DeletePath ? void : never

export type FormResponse<Path extends FormPath> = Path extends '/imports/wells-fargo' ? ImportResult : never
