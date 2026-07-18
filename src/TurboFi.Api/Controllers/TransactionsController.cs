using System.Globalization;
using System.Security.Cryptography;
using System.Text;
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
    public async Task<ActionResult> ImportWellsFargo([FromForm] IFormFile file, [FromForm] Guid accountId)
    {
        if (!await db.FinancialAccounts.AnyAsync(account => account.Id == accountId && account.HouseholdId == HouseholdId))
            return BadRequest("The selected account does not belong to your household.");
        if (file.Length == 0) return BadRequest("Choose a non-empty CSV file.");

        using var reader = new StreamReader(file.OpenReadStream());
        var rows = ParseCsv(await reader.ReadToEndAsync());
        if (rows.Count == 0) return BadRequest("The CSV file contains no transactions.");
        var requiredHeaders = new[] { "DATE", "DESCRIPTION", "AMOUNT", "CHECK #", "STATUS" };
        if (!requiredHeaders.All(header => rows[0].ContainsKey(header))) return BadRequest("This must be a Wells Fargo CSV with DATE, DESCRIPTION, AMOUNT, CHECK #, and STATUS columns.");

        var added = 0;
        foreach (var row in rows)
        {
            if (!DateOnly.TryParse(row["DATE"], CultureInfo.InvariantCulture, DateTimeStyles.None, out var date)
                || !decimal.TryParse(row["AMOUNT"], NumberStyles.Currency, CultureInfo.InvariantCulture, out var amount)
                || string.IsNullOrWhiteSpace(row["DESCRIPTION"]))
                return BadRequest($"Invalid Wells Fargo row for '{row["DESCRIPTION"]}'.");

            var fingerprint = Fingerprint(accountId, date, row["DESCRIPTION"], amount, row["CHECK #"], row["STATUS"]);
            if (await db.FinancialTransactions.AnyAsync(transaction => transaction.HouseholdId == HouseholdId
                && transaction.FinancialAccountId == accountId && transaction.ImportFingerprint == fingerprint)) continue;
            db.FinancialTransactions.Add(new FinancialTransaction
            {
                HouseholdId = HouseholdId, FinancialAccountId = accountId, TransactionDate = date,
                Description = row["DESCRIPTION"].Trim(), Amount = amount, CheckNumber = row["CHECK #"].Trim(),
                Status = row["STATUS"].Trim(), ImportFingerprint = fingerprint
            });
            added++;
        }
        await db.SaveChangesAsync();
        return Ok(new { imported = added, skippedDuplicates = rows.Count - added });
    }

    [HttpGet("transactions/review")]
    public async Task<ActionResult> ReviewQueue()
    {
        var transactions = await db.FinancialTransactions.Where(transaction => transaction.HouseholdId == HouseholdId && transaction.CategoryId == null)
            .OrderByDescending(transaction => transaction.TransactionDate).ToListAsync();
        var categoryByDescription = await db.FinancialTransactions.Where(transaction => transaction.HouseholdId == HouseholdId && transaction.CategoryId != null)
            .GroupBy(transaction => transaction.Description).Select(group => new { Description = group.Key, CategoryId = group.OrderByDescending(transaction => transaction.ReviewedAt).First().CategoryId })
            .ToDictionaryAsync(item => item.Description, item => item.CategoryId);
        return Ok(transactions.Select(transaction => new
        {
            transaction.Id, transaction.TransactionDate, transaction.Description, transaction.Amount, transaction.Status,
            suggestedCategoryId = categoryByDescription.GetValueOrDefault(transaction.Description)
        }));
    }

    [HttpPut("transactions/{id:guid}/category")]
    public async Task<ActionResult> Categorize(Guid id, CategorizeTransactionRequest request)
    {
        var transaction = await db.FinancialTransactions.SingleOrDefaultAsync(item => item.Id == id && item.HouseholdId == HouseholdId);
        if (transaction is null) return NotFound();
        if (!await db.Categories.AnyAsync(category => category.Id == request.CategoryId && category.HouseholdId == HouseholdId)) return BadRequest("Unknown category.");
        transaction.CategoryId = request.CategoryId;
        transaction.ReviewedAt = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync();
        return NoContent();
    }

    private static string Fingerprint(Guid accountId, DateOnly date, string description, decimal amount, string checkNumber, string status)
    {
        var text = string.Join('|', accountId, date, description.Trim().ToUpperInvariant(), amount, checkNumber.Trim(), status.Trim());
        return Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(text)));
    }

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
