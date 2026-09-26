using Microsoft.EntityFrameworkCore;
using TurboFi.Api.Domain;
using TurboFi.Api.Infrastructure;
using TurboFi.Api.Models;

namespace TurboFi.Api.Services;

public sealed class TransactionService(TurboFiDbContext db)
{
    public async Task<ServiceResult> GetTransactionsAsync(
        Guid householdId,
        int? year,
        int? month,
        Guid? accountId,
        Guid? categoryId,
        bool uncategorized)
    {
        var range = GetMonthRange(year, month);
        if (range is null) return ServiceResult.BadRequest("Year and month must identify a valid month.");
        if (categoryId.HasValue && uncategorized)
            return ServiceResult.BadRequest("Choose a category or uncategorized transactions, not both.");

        var (start, end) = range.Value;
        var query = db.FinancialTransactions
            .Where(transaction => transaction.HouseholdId == householdId
                && !transaction.IsTransfer
                && transaction.TransactionDate >= start
                && transaction.TransactionDate < end);

        if (accountId.HasValue)
        {
            if (!await db.FinancialAccounts.AnyAsync(account =>
                    account.Id == accountId.Value && account.HouseholdId == householdId))
                return ServiceResult.BadRequest("The selected account does not belong to your household.");
            query = query.Where(transaction => transaction.FinancialAccountId == accountId.Value);
        }

        if (categoryId.HasValue)
        {
            if (!await db.Categories.AnyAsync(category =>
                    category.Id == categoryId.Value && category.HouseholdId == householdId))
                return ServiceResult.BadRequest("The selected category does not belong to your household.");
            query = query.Where(transaction => transaction.CategoryId == categoryId.Value);
        }
        else if (uncategorized)
        {
            query = query.Where(transaction => transaction.CategoryId == null);
        }

        var accountNames = await db.FinancialAccounts
            .Where(account => account.HouseholdId == householdId)
            .ToDictionaryAsync(account => account.Id, account => account.Name);
        var categoryNames = await db.Categories
            .Where(category => category.HouseholdId == householdId)
            .ToDictionaryAsync(category => category.Id, category => category.Name);
        var transactions = await query
            .OrderByDescending(transaction => transaction.TransactionDate)
            .ThenByDescending(transaction => transaction.ImportedAt)
            .ToListAsync();

        return ServiceResult.Ok(transactions.Select(transaction => new
        {
            transaction.Id,
            transaction.FinancialAccountId,
            accountName = accountNames.GetValueOrDefault(transaction.FinancialAccountId, "Unknown account"),
            transaction.CategoryId,
            categoryName = transaction.CategoryId is { } id
                ? categoryNames.GetValueOrDefault(id, "Unknown category")
                : null,
            transaction.TransactionDate,
            transaction.Description,
            transaction.Amount
        }));
    }

    public async Task<ServiceResult> GetCategorySpendingAsync(
        Guid householdId, int? year, int? month, Guid? accountId)
    {
        var range = GetMonthRange(year, month);
        if (range is null) return ServiceResult.BadRequest("Year and month must identify a valid month.");

        var (start, end) = range.Value;
        var query = db.FinancialTransactions
            .Where(transaction => transaction.HouseholdId == householdId
                && !transaction.IsTransfer
                && transaction.CategoryId != null
                && transaction.Amount < 0
                && transaction.TransactionDate >= start
                && transaction.TransactionDate < end);

        if (accountId.HasValue)
        {
            if (!await db.FinancialAccounts.AnyAsync(account =>
                    account.Id == accountId.Value && account.HouseholdId == householdId))
                return ServiceResult.BadRequest("The selected account does not belong to your household.");
            query = query.Where(transaction => transaction.FinancialAccountId == accountId.Value);
        }

        var categoryNames = await db.Categories
            .Where(category => category.HouseholdId == householdId)
            .ToDictionaryAsync(category => category.Id, category => category.Name);
        var totals = await query
            .GroupBy(transaction => transaction.CategoryId!.Value)
            .Select(group => new
            {
                CategoryId = group.Key,
                Amount = group.Sum(transaction => -transaction.Amount),
                TransactionCount = group.Count()
            })
            .ToListAsync();

        return ServiceResult.Ok(totals
            .Select(total => new
            {
                total.CategoryId,
                name = categoryNames.GetValueOrDefault(total.CategoryId, "Unknown category"),
                total.Amount,
                total.TransactionCount
            })
            .OrderByDescending(total => total.Amount)
            .ThenBy(total => total.name));
    }

    public async Task<ServiceResult> GetReviewQueueAsync(Guid householdId)
    {
        var transactions = await db.FinancialTransactions
            .Where(transaction => transaction.HouseholdId == householdId
                && !transaction.IsTransfer && transaction.CategoryId == null)
            .OrderByDescending(transaction => transaction.TransactionDate)
            .ToListAsync();

        var categorizedTransactions = await db.FinancialTransactions
            .Where(transaction => transaction.HouseholdId == householdId
                && !transaction.IsTransfer && transaction.CategoryId != null)
            .Select(transaction => new { transaction.Description, transaction.CategoryId, transaction.ReviewedAt })
            .ToListAsync();

        var categoryByPrefix = categorizedTransactions
            .GroupBy(transaction => NormalizeDescription(transaction.Description))
            .Where(group => group.Key.Length > 0)
            .ToDictionary(
                group => group.Key,
                group => group.GroupBy(transaction => transaction.CategoryId!.Value)
                    .OrderByDescending(category => category.Count())
                    .ThenByDescending(category => category.Max(transaction => transaction.ReviewedAt))
                    .First().Key);

        var phraseRules = await db.CategoryPhraseRules
            .Where(rule => rule.HouseholdId == householdId)
            .Select(rule => new { rule.Phrase, rule.CategoryId })
            .ToListAsync();

        var result = transactions.Select(transaction =>
        {
            var phraseMatch = phraseRules.FirstOrDefault(rule =>
                transaction.Description.Contains(rule.Phrase, StringComparison.OrdinalIgnoreCase));
            Guid? suggestedCategoryId;
            string? suggestionSource;
            string? matchedPhrase;
            if (phraseMatch is not null)
            {
                suggestedCategoryId = phraseMatch.CategoryId;
                suggestionSource = "phraseRule";
                matchedPhrase = phraseMatch.Phrase;
            }
            else
            {
                var prefixKey = NormalizeDescription(transaction.Description);
                suggestedCategoryId = categoryByPrefix.GetValueOrDefault(prefixKey);
                suggestionSource = suggestedCategoryId.HasValue ? "prefix" : null;
                matchedPhrase = null;
            }
            return new
            {
                transaction.Id, transaction.FinancialAccountId, transaction.TransactionDate,
                transaction.Description, transaction.Amount, transaction.Status,
                suggestedCategoryId, suggestionSource, matchedPhrase
            };
        });

        return ServiceResult.Ok(result);
    }

    public async Task<ServiceResult> GetTransfersAsync(Guid householdId)
    {
        var accountNames = await db.FinancialAccounts
            .Where(account => account.HouseholdId == householdId)
            .ToDictionaryAsync(account => account.Id, account => account.Name);

        var transactions = await db.FinancialTransactions
            .Where(transaction => transaction.HouseholdId == householdId && transaction.IsTransfer)
            .OrderByDescending(transaction => transaction.TransactionDate)
            .Select(transaction => new
            {
                transaction.Id,
                transaction.TransactionDate,
                transaction.Description,
                transaction.Amount,
                transaction.TransferDestinationAccountId,
                transaction.TransferDestinationName
            })
            .ToListAsync();

        var result = transactions.Select(transaction => new
        {
            transaction.Id,
            transaction.TransactionDate,
            transaction.Description,
            transaction.Amount,
            destination = transaction.TransferDestinationAccountId is { } accountId
                ? accountNames.GetValueOrDefault(accountId, "Unknown account")
                : transaction.TransferDestinationName
        });

        return ServiceResult.Ok(result);
    }

    public async Task<ServiceResult> CategorizeAsync(Guid householdId, Guid id, CategorizeTransactionRequest request)
    {
        var transaction = await db.FinancialTransactions
            .SingleOrDefaultAsync(item => item.Id == id && item.HouseholdId == householdId);
        if (transaction is null) return ServiceResult.NotFound();
        if (transaction.IsTransfer)
            return ServiceResult.BadRequest("Transfers cannot be categorized. Mark it as not a transfer first.");
        if (!await db.Categories.AnyAsync(category =>
                category.Id == request.CategoryId && category.HouseholdId == householdId && !category.IsArchived))
            return ServiceResult.BadRequest("Unknown or archived category.");

        transaction.CategoryId = request.CategoryId;
        transaction.ReviewedAt = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync();
        return ServiceResult.NoContent();
    }

    public async Task<ServiceResult> MarkTransferAsync(Guid householdId, Guid id, MarkTransferRequest request)
    {
        var transaction = await db.FinancialTransactions
            .SingleOrDefaultAsync(item => item.Id == id && item.HouseholdId == householdId);
        if (transaction is null) return ServiceResult.NotFound();

        var destinationName = request.DestinationName?.Trim();
        if ((request.DestinationAccountId is null) == string.IsNullOrWhiteSpace(destinationName))
            return ServiceResult.BadRequest("Choose a destination account or enter another destination.");
        if (destinationName?.Length > 200)
            return ServiceResult.BadRequest("The transfer destination cannot exceed 200 characters.");

        if (request.DestinationAccountId is { } destinationAccountId)
        {
            if (destinationAccountId == transaction.FinancialAccountId)
                return ServiceResult.BadRequest("A transfer destination must be a different account.");
            if (!await db.FinancialAccounts.AnyAsync(account =>
                    account.Id == destinationAccountId && account.HouseholdId == householdId))
                return ServiceResult.BadRequest("The transfer destination account does not belong to your household.");
            destinationName = null;
        }

        transaction.IsTransfer = true;
        transaction.CategoryId = null;
        transaction.TransferDestinationAccountId = request.DestinationAccountId;
        transaction.TransferDestinationName = destinationName;
        transaction.ReviewedAt = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync();
        return ServiceResult.NoContent();
    }

    public async Task<ServiceResult> UnmarkTransferAsync(Guid householdId, Guid id)
    {
        var transaction = await db.FinancialTransactions
            .SingleOrDefaultAsync(item => item.Id == id && item.HouseholdId == householdId);
        if (transaction is null) return ServiceResult.NotFound();
        if (!transaction.IsTransfer)
            return ServiceResult.BadRequest("This transaction is not marked as a transfer.");

        transaction.IsTransfer = false;
        transaction.TransferDestinationAccountId = null;
        transaction.TransferDestinationName = null;
        transaction.ReviewedAt = null;
        await db.SaveChangesAsync();
        return ServiceResult.NoContent();
    }

    private static string NormalizeDescription(string description) => new(description
        .Where(char.IsLetterOrDigit)
        .Select(char.ToUpperInvariant)
        .Take(8)
        .ToArray());

    private static (DateOnly Start, DateOnly End)? GetMonthRange(int? year, int? month)
    {
        var now = DateOnly.FromDateTime(DateTime.UtcNow);
        var selectedYear = year ?? now.Year;
        var selectedMonth = month ?? now.Month;
        if (selectedMonth is < 1 or > 12 || selectedYear is < 1 or > 9999) return null;

        var start = new DateOnly(selectedYear, selectedMonth, 1);
        return (start, start.AddMonths(1));
    }
}
