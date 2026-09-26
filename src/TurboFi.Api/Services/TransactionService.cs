using Microsoft.EntityFrameworkCore;
using TurboFi.Api.Domain;
using TurboFi.Api.Infrastructure;
using TurboFi.Api.Models;

namespace TurboFi.Api.Services;

public sealed class TransactionService(TurboFiDbContext db)
{
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
}
