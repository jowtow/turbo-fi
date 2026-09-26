using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using CsvHelper;
using CsvHelper.Configuration;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using TurboFi.Api.Domain;
using TurboFi.Api.Infrastructure;
using TurboFi.Api.Models;

namespace TurboFi.Api.Services;

public sealed class ImportService(TurboFiDbContext db)
{
    public async Task<List<ImportSchemeResponse>> GetSchemesAsync(Guid householdId)
    {
        var schemes = await db.ImportSchemes
            .Where(s => s.IsGlobal || s.HouseholdId == householdId)
            .OrderBy(s => s.IsGlobal ? 0 : 1)
            .ThenBy(s => s.Name)
            .ToListAsync();
        return schemes.Select(ToResponse).ToList();
    }

    public async Task<ServiceResult> CreateSchemeAsync(Guid householdId, ImportSchemeRequest request)
    {
        var name = request.Name.Trim();
        if (string.IsNullOrWhiteSpace(name)) return ServiceResult.BadRequest("Scheme name is required.");
        if (await db.ImportSchemes.AnyAsync(s => s.HouseholdId == householdId && s.Name == name))
            return ServiceResult.Conflict("An import scheme with that name already exists for your household.");

        var scheme = new ImportScheme
        {
            HouseholdId = householdId,
            IsGlobal = false,
            Name = name,
            DateColumn = request.DateColumn.Trim(),
            DescriptionColumn = request.DescriptionColumn.Trim(),
            AmountColumn = request.AmountColumn.Trim(),
            CheckNumberColumn = request.CheckNumberColumn?.Trim(),
            StatusColumn = request.StatusColumn?.Trim(),
            DateFormat = string.IsNullOrWhiteSpace(request.DateFormat) ? "M/d/yyyy" : request.DateFormat.Trim(),
            InvertAmount = request.InvertAmount,
            SkipHeaderRows = Math.Max(0, request.SkipHeaderRows),
            RequiredHeadersJson = request.RequiredHeaders is { Length: > 0 }
                ? JsonSerializer.Serialize(request.RequiredHeaders)
                : null
        };
        db.ImportSchemes.Add(scheme);
        await db.SaveChangesAsync();
        return ServiceResult.Created(ToResponse(scheme));
    }

    public async Task<ServiceResult> UpdateSchemeAsync(Guid householdId, Guid id, ImportSchemeRequest request)
    {
        var scheme = await db.ImportSchemes.SingleOrDefaultAsync(s => s.Id == id && s.HouseholdId == householdId && !s.IsGlobal);
        if (scheme is null) return ServiceResult.NotFound();

        var name = request.Name.Trim();
        if (string.IsNullOrWhiteSpace(name)) return ServiceResult.BadRequest("Scheme name is required.");
        if (await db.ImportSchemes.AnyAsync(s => s.HouseholdId == householdId && s.Name == name && s.Id != id))
            return ServiceResult.Conflict("An import scheme with that name already exists for your household.");

        scheme.Name = name;
        scheme.DateColumn = request.DateColumn.Trim();
        scheme.DescriptionColumn = request.DescriptionColumn.Trim();
        scheme.AmountColumn = request.AmountColumn.Trim();
        scheme.CheckNumberColumn = request.CheckNumberColumn?.Trim();
        scheme.StatusColumn = request.StatusColumn?.Trim();
        scheme.DateFormat = string.IsNullOrWhiteSpace(request.DateFormat) ? "M/d/yyyy" : request.DateFormat.Trim();
        scheme.InvertAmount = request.InvertAmount;
        scheme.SkipHeaderRows = Math.Max(0, request.SkipHeaderRows);
        scheme.RequiredHeadersJson = request.RequiredHeaders is { Length: > 0 }
            ? JsonSerializer.Serialize(request.RequiredHeaders)
            : null;

        await db.SaveChangesAsync();
        return ServiceResult.Ok(ToResponse(scheme));
    }

    public async Task<ServiceResult> DeleteSchemeAsync(Guid householdId, Guid id)
    {
        var scheme = await db.ImportSchemes.SingleOrDefaultAsync(s => s.Id == id && s.HouseholdId == householdId && !s.IsGlobal);
        if (scheme is null) return ServiceResult.NotFound();

        db.ImportSchemes.Remove(scheme);
        await db.SaveChangesAsync();
        return ServiceResult.NoContent();
    }

    public async Task<ServiceResult> ImportCsvAsync(
        Guid householdId,
        Guid accountId,
        Guid schemeId,
        IFormFile file,
        Dictionary<int, string>? descriptionOverrides)
    {
        if (!await db.FinancialAccounts.AnyAsync(account => account.Id == accountId && account.HouseholdId == householdId))
            return ServiceResult.BadRequest("The selected account does not belong to your household.");
        if (file.Length == 0) return ServiceResult.BadRequest("Choose a non-empty CSV file.");

        var scheme = await db.ImportSchemes.SingleOrDefaultAsync(s =>
            s.Id == schemeId && (s.IsGlobal || s.HouseholdId == householdId));
        if (scheme is null) return ServiceResult.BadRequest("The selected import scheme is unavailable.");

        var requiredHeaders = scheme.RequiredHeadersJson is not null
            ? JsonSerializer.Deserialize<string[]>(scheme.RequiredHeadersJson)
            : null;

        // Parse rows using CsvHelper (handles embedded newlines, quoted fields, etc.)
        List<RawRow> rawRows;
        try
        {
            rawRows = await ParseCsvAsync(file, scheme, requiredHeaders);
        }
        catch (CsvHelperException ex)
        {
            return ServiceResult.BadRequest($"CSV parsing failed: {ex.Message}");
        }
        catch (InvalidOperationException ex)
        {
            return ServiceResult.BadRequest(ex.Message);
        }

        if (rawRows.Count == 0) return ServiceResult.BadRequest("The CSV file contains no transactions.");

        if (descriptionOverrides?.Keys.Any(index => index < 0 || index >= rawRows.Count) == true)
            return ServiceResult.BadRequest("Transaction description changes reference an invalid CSV row.");

        var importedRows = new List<ImportedRow>();
        for (var index = 0; index < rawRows.Count; index++)
        {
            var raw = rawRows[index];
            var finalDescription = (descriptionOverrides?.GetValueOrDefault(index) ?? raw.Description).Trim();
            if (string.IsNullOrWhiteSpace(finalDescription))
                return ServiceResult.BadRequest($"Row {index + 1} has an empty description.");

            importedRows.Add(new ImportedRow(
                index,
                raw.Date,
                finalDescription,
                raw.Amount,
                raw.CheckNumber,
                raw.Status,
                Fingerprint(accountId, raw.Date, finalDescription, raw.Amount, raw.CheckNumber, raw.Status)));
        }

        var fingerprints = importedRows.Select(row => row.Fingerprint).ToHashSet();
        var existingFingerprints = await db.FinancialTransactions
            .Where(transaction => transaction.HouseholdId == householdId
                && transaction.FinancialAccountId == accountId
                && fingerprints.Contains(transaction.ImportFingerprint))
            .Select(transaction => transaction.ImportFingerprint)
            .ToHashSetAsync();

        var repeatedFingerprints = importedRows
            .GroupBy(row => row.Fingerprint)
            .Where(group => group.Count() > 1)
            .Select(group => group.Key)
            .ToHashSet();

        var intraFileConflicts = importedRows
            .Where(row => repeatedFingerprints.Contains(row.Fingerprint))
            .Select(row => new
            {
                row.Index,
                row.Description,
                row.TransactionDate,
                row.Amount,
                reason = "Matches another transaction in this CSV file."
            })
            .ToList();

        if (intraFileConflicts.Count > 0)
            return ServiceResult.Conflict(new { conflicts = intraFileConflicts });

        var skipped = importedRows
            .Where(row => existingFingerprints.Contains(row.Fingerprint))
            .Select(row => new { row.Index, row.Description, row.TransactionDate, row.Amount })
            .ToList();
        var rowsToImport = importedRows.Where(row => !existingFingerprints.Contains(row.Fingerprint)).ToList();

        foreach (var row in rowsToImport)
        {
            db.FinancialTransactions.Add(new FinancialTransaction
            {
                HouseholdId = householdId,
                FinancialAccountId = accountId,
                TransactionDate = row.TransactionDate,
                Description = row.Description,
                Amount = row.Amount,
                CheckNumber = row.CheckNumber,
                Status = row.Status,
                ImportFingerprint = row.Fingerprint
            });
        }
        await db.SaveChangesAsync();
        return ServiceResult.Ok(new { imported = rowsToImport.Count, skipped });
    }

    private static async Task<List<RawRow>> ParseCsvAsync(IFormFile file, ImportScheme scheme, string[]? requiredHeaders)
    {
        var config = new CsvConfiguration(CultureInfo.InvariantCulture)
        {
            HasHeaderRecord = true,
            TrimOptions = TrimOptions.Trim,
            DetectDelimiter = false,
        };

        using var stream = file.OpenReadStream();
        using var reader = new StreamReader(stream);

        // Skip optional metadata rows that appear before the actual header
        for (var i = 0; i < scheme.SkipHeaderRows; i++)
            await reader.ReadLineAsync();

        using var csv = new CsvReader(reader, config);

        await csv.ReadAsync();
        csv.ReadHeader();

        // Normalize headers to upper-case for case-insensitive validation
        var presentHeaders = csv.HeaderRecord!
            .Select(h => h.TrimStart('\uFEFF').Trim().ToUpperInvariant())
            .ToHashSet();

        if (requiredHeaders is { Length: > 0 })
        {
            var missing = requiredHeaders
                .Select(h => h.ToUpperInvariant())
                .Where(h => !presentHeaders.Contains(h))
                .ToList();
            if (missing.Count > 0)
                throw new InvalidOperationException($"Missing required columns: {string.Join(", ", missing)}.");
        }

        var rows = new List<RawRow>();
        while (await csv.ReadAsync())
        {
            var dateRaw = csv.GetField(scheme.DateColumn)?.Trim() ?? "";
            var descriptionRaw = csv.GetField(scheme.DescriptionColumn)?.Trim() ?? "";
            var amountRaw = csv.GetField(scheme.AmountColumn)?.Trim() ?? "";
            var checkNumber = (scheme.CheckNumberColumn is not null ? csv.GetField(scheme.CheckNumberColumn) : null)?.Trim() ?? "";
            var status = (scheme.StatusColumn is not null ? csv.GetField(scheme.StatusColumn) : null)?.Trim() ?? "";

            if (!DateOnly.TryParseExact(dateRaw, scheme.DateFormat, CultureInfo.InvariantCulture, DateTimeStyles.None, out var date)
                && !DateOnly.TryParse(dateRaw, CultureInfo.InvariantCulture, DateTimeStyles.None, out date))
                throw new InvalidOperationException($"Cannot parse date '{dateRaw}' using format '{scheme.DateFormat}'.");

            if (!TryParseAmount(amountRaw, out var amount))
                throw new InvalidOperationException($"Cannot parse amount '{amountRaw}'.");

            if (scheme.InvertAmount) amount = -amount;

            rows.Add(new RawRow(date, descriptionRaw, amount, checkNumber, status));
        }

        return rows;
    }

    private static bool TryParseAmount(string value, out decimal amount)
    {
        var normalized = value.Trim();
        if (normalized.Length >= 2 && normalized[0] == '(' && normalized[^1] == ')')
            normalized = $"-{normalized[1..^1].Trim()}";

        return decimal.TryParse(
            normalized,
            NumberStyles.Currency,
            CultureInfo.GetCultureInfo("en-US"),
            out amount);
    }

    private static string Fingerprint(Guid accountId, DateOnly date, string description, decimal amount, string checkNumber, string status)
    {
        var text = string.Join('|', accountId, date, description.Trim().ToUpperInvariant(), amount, checkNumber.Trim(), status.Trim());
        return Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(text)));
    }

    private static ImportSchemeResponse ToResponse(ImportScheme scheme) => new(
        scheme.Id,
        scheme.Name,
        scheme.IsGlobal,
        scheme.DateColumn,
        scheme.DescriptionColumn,
        scheme.AmountColumn,
        scheme.CheckNumberColumn,
        scheme.StatusColumn,
        scheme.DateFormat,
        scheme.InvertAmount,
        scheme.SkipHeaderRows,
        scheme.RequiredHeadersJson is not null
            ? JsonSerializer.Deserialize<string[]>(scheme.RequiredHeadersJson)
            : null);

    private sealed record RawRow(DateOnly Date, string Description, decimal Amount, string CheckNumber, string Status);

    private sealed record ImportedRow(
        int Index,
        DateOnly TransactionDate,
        string Description,
        decimal Amount,
        string CheckNumber,
        string Status,
        string Fingerprint);
}
