using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TurboFi.Api.Domain;
using TurboFi.Api.Infrastructure;

namespace TurboFi.Api.Controllers;

[ApiController]
[Authorize]
[Route("api")]
public sealed class TransactionsController(TurboFiDbContext db) : ControllerBase
{
    private Guid HouseholdId => Guid.Parse(User.FindFirst("householdId")!.Value);

    [HttpPost("imports/wells-fargo")]
    [RequestSizeLimit(10_000_000)]
    public async Task<ActionResult> ImportWellsFargo(
        [FromForm] IFormFile file,
        [FromForm] Guid accountId,
        [FromForm] string? descriptionOverrides)
    {
        if (!await db.FinancialAccounts.AnyAsync(account => account.Id == accountId && account.HouseholdId == HouseholdId))
            return BadRequest("The selected account does not belong to your household.");
        if (file.Length == 0) return BadRequest("Choose a non-empty CSV file.");

        using var reader = new StreamReader(file.OpenReadStream());
        var rows = ParseCsv(await reader.ReadToEndAsync());
        if (rows.Count == 0) return BadRequest("The CSV file contains no transactions.");
        var requiredHeaders = new[] { "DATE", "DESCRIPTION", "AMOUNT", "CHECK #", "STATUS" };
        if (!requiredHeaders.All(header => rows[0].ContainsKey(header))) return BadRequest("This must be a Wells Fargo CSV with DATE, DESCRIPTION, AMOUNT, CHECK #, and STATUS columns.");

        Dictionary<int, string>? overrides;
        try
        {
            overrides = string.IsNullOrWhiteSpace(descriptionOverrides)
                ? null
                : JsonSerializer.Deserialize<Dictionary<int, string>>(descriptionOverrides);
        }
        catch (JsonException)
        {
            return BadRequest("Transaction description changes could not be read.");
        }

        if (overrides?.Keys.Any(index => index < 0 || index >= rows.Count) == true)
            return BadRequest("Transaction description changes reference an invalid CSV row.");

        var importedRows = new List<ImportedRow>();
        for (var index = 0; index < rows.Count; index++)
        {
            var row = rows[index];
            var description = overrides?.GetValueOrDefault(index) ?? row["DESCRIPTION"];
            if (!DateOnly.TryParse(row["DATE"], CultureInfo.InvariantCulture, DateTimeStyles.None, out var date)
                || !decimal.TryParse(row["AMOUNT"], NumberStyles.Currency, CultureInfo.InvariantCulture, out var amount)
                || string.IsNullOrWhiteSpace(description))
                return BadRequest($"Invalid Wells Fargo row for '{row["DESCRIPTION"]}'.");

            importedRows.Add(new ImportedRow(
                index, date, description.Trim(), amount, row["CHECK #"].Trim(), row["STATUS"].Trim(),
                Fingerprint(accountId, date, description, amount, row["CHECK #"], row["STATUS"])));
        }

        var fingerprints = importedRows.Select(row => row.Fingerprint).ToHashSet();
        var existingFingerprints = await db.FinancialTransactions
            .Where(transaction => transaction.HouseholdId == HouseholdId
                && transaction.FinancialAccountId == accountId
                && fingerprints.Contains(transaction.ImportFingerprint))
            .Select(transaction => transaction.ImportFingerprint)
            .ToHashSetAsync();
        var repeatedFingerprints = importedRows.GroupBy(row => row.Fingerprint)
            .Where(group => group.Count() > 1)
            .Select(group => group.Key)
            .ToHashSet();

        // Intra-file duplicates still require user resolution via descriptionOverrides.
        var intraFileConflicts = importedRows
            .Where(row => repeatedFingerprints.Contains(row.Fingerprint))
            .Select(row => new
            {
                row.Index,
                row.Description,
                row.TransactionDate,
                row.Amount,
                reason = "Matches another transaction in this CSV file."
            });

        if (intraFileConflicts.Any())
            return Conflict(new { conflicts = intraFileConflicts });

        // Rows already in the DB are silently skipped.
        var skipped = importedRows
            .Where(row => existingFingerprints.Contains(row.Fingerprint))
            .Select(row => new { row.Index, row.Description, row.TransactionDate, row.Amount })
            .ToList();
        var rowsToImport = importedRows.Where(row => !existingFingerprints.Contains(row.Fingerprint)).ToList();

        foreach (var row in rowsToImport)
        {
            db.FinancialTransactions.Add(new FinancialTransaction
            {
                HouseholdId = HouseholdId, FinancialAccountId = accountId, TransactionDate = row.TransactionDate,
                Description = row.Description, Amount = row.Amount, CheckNumber = row.CheckNumber,
                Status = row.Status, ImportFingerprint = row.Fingerprint
            });
        }
        await db.SaveChangesAsync();
        return Ok(new { imported = rowsToImport.Count, skipped });
    }

    [HttpGet("transactions/review")]
    public async Task<ActionResult> ReviewQueue()
    {
        var transactions = await db.FinancialTransactions.Where(transaction =>
                transaction.HouseholdId == HouseholdId && !transaction.IsTransfer && transaction.CategoryId == null)
            .OrderByDescending(transaction => transaction.TransactionDate).ToListAsync();
        var categorizedTransactions = await db.FinancialTransactions.Where(transaction =>
                transaction.HouseholdId == HouseholdId && !transaction.IsTransfer && transaction.CategoryId != null)
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
            .Where(rule => rule.HouseholdId == HouseholdId)
            .Select(rule => new { rule.Phrase, rule.CategoryId })
            .ToListAsync();
        return Ok(transactions.Select(transaction =>
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
        }));
    }

    [HttpPut("transactions/{id:guid}/category")]
    public async Task<ActionResult> Categorize(Guid id, CategorizeTransactionRequest request)
    {
        var transaction = await db.FinancialTransactions.SingleOrDefaultAsync(item => item.Id == id && item.HouseholdId == HouseholdId);
        if (transaction is null) return NotFound();
        if (transaction.IsTransfer) return BadRequest("Transfers cannot be categorized. Mark it as not a transfer first.");
        if (!await db.Categories.AnyAsync(category =>
                category.Id == request.CategoryId && category.HouseholdId == HouseholdId && !category.IsArchived))
            return BadRequest("Unknown or archived category.");
        transaction.CategoryId = request.CategoryId;
        transaction.ReviewedAt = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync();
        return NoContent();
    }

    [HttpPost("transactions/{id:guid}/transfer")]
    public async Task<ActionResult> MarkTransfer(Guid id, MarkTransferRequest request)
    {
        var transaction = await db.FinancialTransactions.SingleOrDefaultAsync(item => item.Id == id && item.HouseholdId == HouseholdId);
        if (transaction is null) return NotFound();

        var destinationName = request.DestinationName?.Trim();
        if ((request.DestinationAccountId is null) == string.IsNullOrWhiteSpace(destinationName))
            return BadRequest("Choose a destination account or enter another destination.");
        if (destinationName?.Length > 200)
            return BadRequest("The transfer destination cannot exceed 200 characters.");

        if (request.DestinationAccountId is { } destinationAccountId)
        {
            if (destinationAccountId == transaction.FinancialAccountId)
                return BadRequest("A transfer destination must be a different account.");
            if (!await db.FinancialAccounts.AnyAsync(account => account.Id == destinationAccountId && account.HouseholdId == HouseholdId))
                return BadRequest("The transfer destination account does not belong to your household.");
            destinationName = null;
        }

        transaction.IsTransfer = true;
        transaction.CategoryId = null;
        transaction.TransferDestinationAccountId = request.DestinationAccountId;
        transaction.TransferDestinationName = destinationName;
        transaction.ReviewedAt = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync();
        return NoContent();
    }

    [HttpDelete("transactions/{id:guid}/transfer")]
    public async Task<ActionResult> UnmarkTransfer(Guid id)
    {
        var transaction = await db.FinancialTransactions.SingleOrDefaultAsync(item => item.Id == id && item.HouseholdId == HouseholdId);
        if (transaction is null) return NotFound();
        if (!transaction.IsTransfer) return BadRequest("This transaction is not marked as a transfer.");

        transaction.IsTransfer = false;
        transaction.TransferDestinationAccountId = null;
        transaction.TransferDestinationName = null;
        transaction.ReviewedAt = null;
        await db.SaveChangesAsync();
        return NoContent();
    }

    [HttpGet("transactions/transfers")]
    public async Task<ActionResult> Transfers()
    {
        var accountNames = await db.FinancialAccounts
            .Where(account => account.HouseholdId == HouseholdId)
            .ToDictionaryAsync(account => account.Id, account => account.Name);
        var transactions = await db.FinancialTransactions
            .Where(transaction => transaction.HouseholdId == HouseholdId && transaction.IsTransfer)
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

        return Ok(transactions.Select(transaction => new
        {
            transaction.Id,
            transaction.TransactionDate,
            transaction.Description,
            transaction.Amount,
            destination = transaction.TransferDestinationAccountId is { } accountId
                ? accountNames.GetValueOrDefault(accountId, "Unknown account")
                : transaction.TransferDestinationName
        }));
    }

    private static string Fingerprint(Guid accountId, DateOnly date, string description, decimal amount, string checkNumber, string status)
    {
        var text = string.Join('|', accountId, date, description.Trim().ToUpperInvariant(), amount, checkNumber.Trim(), status.Trim());
        return Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(text)));
    }

    private static string NormalizeDescription(string description) => new(description
        .Where(char.IsLetterOrDigit)
        .Select(char.ToUpperInvariant)
        .Take(8)
        .ToArray());

    private sealed record ImportedRow(
        int Index,
        DateOnly TransactionDate,
        string Description,
        decimal Amount,
        string CheckNumber,
        string Status,
        string Fingerprint);

    private static List<Dictionary<string, string>> ParseCsv(string contents)
    {
        var lines = contents.Split(["\r\n", "\n"], StringSplitOptions.RemoveEmptyEntries);
        var headers = SplitLine(lines[0]).Select(header => header.Trim().TrimStart('\uFEFF').ToUpperInvariant()).ToArray();
        return lines.Skip(1).Select(line =>
        {
            var values = SplitLine(line);
            return headers.Select((header, index) => new { header, value = index < values.Count ? values[index] : "" })
                .ToDictionary(item => item.header, item => item.value);
        }).ToList();
    }

    private static List<string> SplitLine(string line)
    {
        var result = new List<string>();
        var value = new StringBuilder();
        var quoted = false;
        for (var index = 0; index < line.Length; index++)
        {
            if (line[index] == '"' && index + 1 < line.Length && line[index + 1] == '"') { value.Append('"'); index++; }
            else if (line[index] == '"') quoted = !quoted;
            else if (line[index] == ',' && !quoted) { result.Add(value.ToString()); value.Clear(); }
            else value.Append(line[index]);
        }
        result.Add(value.ToString());
        return result;
    }
}

public sealed record CategorizeTransactionRequest(Guid CategoryId);
public sealed record MarkTransferRequest(Guid? DestinationAccountId, string? DestinationName);
