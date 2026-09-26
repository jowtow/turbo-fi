export type Workspace = "dashboard" | "categorize" | "plan" | "settings";

export type CategoryTotal = {
  categoryId: string;
  name: string;
  planned: number;
  actual: number;
  isFixed: boolean;
};
export type ExpenseTypeTotal = {
  expenseTypeId: string;
  name: string;
  planned: number;
  actual: number;
  categories: CategoryTotal[];
};
export type Dashboard = {
  month: string;
  reviewCount: number;
  expenseTypes: ExpenseTypeTotal[];
};
export type Account = {
  id: string;
  name: string;
  institution?: string;
  lastFour?: string;
  isActive: boolean;
};
export type ExpenseType = { id: string; name: string };
export type Category = {
  id: string;
  expenseTypeId: string;
  name: string;
  color?: string;
  isArchived: boolean;
};
export type PlannedEntry = {
  id: string;
  amount: number;
  categoryId: string;
  isFixed: boolean;
};
export type ReviewTransaction = {
  id: string;
  financialAccountId: string;
  transactionDate: string;
  description: string;
  amount: number;
  suggestedCategoryId?: string;
  suggestionSource?: "phraseRule" | "prefix";
  matchedPhrase?: string;
};
export type Transaction = {
  id: string;
  financialAccountId: string;
  accountName: string;
  categoryId?: string;
  categoryName?: string;
  transactionDate: string;
  description: string;
  amount: number;
};
export type CategorySpending = {
  categoryId: string;
  name: string;
  amount: number;
  transactionCount: number;
};
export type CategoryPhraseRule = {
  id: string;
  phrase: string;
  categoryId: string;
};
export type ImportConflict = {
  index: number;
  description: string;
  transactionDate: string;
  amount: number;
  reason: string;
};
export type ImportResult = {
  imported?: number;
  skipped?: Array<{
    index: number;
    description: string;
    transactionDate: string;
    amount: number;
  }>;
  conflicts?: ImportConflict[];
};
export type ImportScheme = {
  id: string;
  name: string;
  isGlobal: boolean;
  dateColumn: string;
  descriptionColumn: string;
  amountColumn: string;
  checkNumberColumn?: string | null;
  statusColumn?: string | null;
  dateFormat: string;
  invertAmount: boolean;
  skipHeaderRows: number;
  requiredHeaders?: string[] | null;
};
export type BurndownPoint = {
  day: number;
  planned: number;
  actual: number | null;
};
export type PhraseRule = { id: string; phrase: string; categoryId: string };
