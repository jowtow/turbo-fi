using System.Globalization;
using Microsoft.EntityFrameworkCore;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;
using TurboFi.Api.Infrastructure;

namespace TurboFi.Api.Services;

public sealed class MonthlyReportService(TurboFiDbContext db)
{
    public async Task<ServiceResult> GetMonthlyReportAsync(
        Guid householdId, int? year, int? month, string? search, Guid? expenseTypeId, string? status)
    {
        if (!TryGetMonthRange(year, month, out var start, out var end))
            return ServiceResult.BadRequest("Year and month must identify a valid month.");
        if (status is not null and not ("Over plan" or "On track"))
            return ServiceResult.BadRequest("Status must be Over plan or On track.");

        var normalizedSearch = search?.Trim();
        if (string.IsNullOrWhiteSpace(normalizedSearch)) normalizedSearch = null;

        var expenseTypes = await db.ExpenseTypes
            .Where(type => type.HouseholdId == householdId)
            .ToDictionaryAsync(type => type.Id, type => type.Name);
        if (expenseTypeId.HasValue && !expenseTypes.ContainsKey(expenseTypeId.Value))
            return ServiceResult.BadRequest("The selected expense type does not belong to your household.");

        var categories = await db.Categories
            .Where(category => category.HouseholdId == householdId)
            .Select(category => new ReportCategory(category.Id, category.Name, category.ExpenseTypeId))
            .ToDictionaryAsync(category => category.Id);
        var plannedByCategory = await db.PlannedEntries
            .Where(entry => entry.HouseholdId == householdId && entry.PlanMonth == start && entry.IsActive)
            .GroupBy(entry => entry.CategoryId)
            .Select(group => new { CategoryId = group.Key, Amount = group.Sum(entry => Math.Abs(entry.Amount)) })
            .ToDictionaryAsync(item => item.CategoryId, item => item.Amount);
        var actualByCategory = await db.FinancialTransactions
            .Where(transaction => transaction.HouseholdId == householdId && !transaction.IsTransfer
                && transaction.CategoryId != null && transaction.Amount < 0
                && transaction.TransactionDate >= start && transaction.TransactionDate < end)
            .GroupBy(transaction => transaction.CategoryId!.Value)
            .Select(group => new { CategoryId = group.Key, Amount = group.Sum(transaction => -transaction.Amount) })
            .ToDictionaryAsync(item => item.CategoryId, item => item.Amount);

        var transactions = await db.FinancialTransactions
            .Where(transaction => transaction.HouseholdId == householdId
                && transaction.TransactionDate >= start && transaction.TransactionDate < end)
            .OrderBy(transaction => transaction.TransactionDate)
            .ThenBy(transaction => transaction.Description)
            .Select(transaction => new ReportTransaction(
                transaction.TransactionDate, transaction.Description, transaction.Amount,
                transaction.CategoryId, transaction.IsTransfer))
            .ToListAsync();

        var categoryTransactions = transactions
            .Where(transaction => !transaction.IsTransfer && transaction.CategoryId.HasValue
                && categories.TryGetValue(transaction.CategoryId.Value, out var category)
                && MatchesCategory(category, normalizedSearch, expenseTypeId, status, expenseTypes,
                    plannedByCategory, actualByCategory))
            .GroupBy(transaction => transaction.CategoryId!.Value)
            .Select(group => new ReportSection(
                categories[group.Key].Name,
                group.Sum(transaction => transaction.Amount),
                group.ToList()))
            .OrderByDescending(section => Math.Abs(section.Total))
            .ThenBy(section => section.Name)
            .ToList();

        var allowUncategorizedOrTransfers = !expenseTypeId.HasValue && status is null;
        if (allowUncategorizedOrTransfers
            && (normalizedSearch is null || "Uncategorized".Contains(normalizedSearch, StringComparison.OrdinalIgnoreCase)))
        {
            var uncategorized = transactions.Where(transaction => !transaction.IsTransfer && !transaction.CategoryId.HasValue).ToList();
            if (uncategorized.Count > 0)
                categoryTransactions.Add(new ReportSection("Uncategorized", uncategorized.Sum(transaction => transaction.Amount), uncategorized));
        }
        if (allowUncategorizedOrTransfers
            && (normalizedSearch is null || "Transfers".Contains(normalizedSearch, StringComparison.OrdinalIgnoreCase)))
        {
            var transfers = transactions.Where(transaction => transaction.IsTransfer).ToList();
            if (transfers.Count > 0)
                categoryTransactions.Add(new ReportSection("Transfers", transfers.Sum(transaction => transaction.Amount), transfers));
        }

        var regularTransactions = categoryTransactions
            .Where(section => section.Name is not "Transfers")
            .SelectMany(section => section.Transactions)
            .Where(transaction => !transaction.IsTransfer)
            .ToList();
        var income = regularTransactions.Where(transaction => transaction.Amount > 0).Sum(transaction => transaction.Amount);
        var expenses = -regularTransactions.Where(transaction => transaction.Amount < 0).Sum(transaction => transaction.Amount);
        var filters = BuildFilterDescription(normalizedSearch, expenseTypeId, status, expenseTypes);
        var report = new MonthlyReport(start, end, DateTimeOffset.UtcNow, filters, income, expenses, income - expenses, categoryTransactions);
        return ServiceResult.Ok(new GeneratedReport(CreatePdf(report), $"turbo-fi-report-{start:yyyy-MM}.pdf"));
    }

    private static bool MatchesCategory(
        ReportCategory category, string? search, Guid? expenseTypeId, string? status,
        IReadOnlyDictionary<Guid, string> expenseTypes, IReadOnlyDictionary<Guid, decimal> plannedByCategory,
        IReadOnlyDictionary<Guid, decimal> actualByCategory)
    {
        var expenseTypeName = expenseTypes.GetValueOrDefault(category.ExpenseTypeId, "Uncategorized");
        if (search is not null && !category.Name.Contains(search, StringComparison.OrdinalIgnoreCase)
            && !expenseTypeName.Contains(search, StringComparison.OrdinalIgnoreCase))
            return false;
        if (expenseTypeId.HasValue && category.ExpenseTypeId != expenseTypeId) return false;
        var isOverPlan = plannedByCategory.GetValueOrDefault(category.Id) > 0
            && actualByCategory.GetValueOrDefault(category.Id) > plannedByCategory.GetValueOrDefault(category.Id);
        return status is null || status == (isOverPlan ? "Over plan" : "On track");
    }

    private static string BuildFilterDescription(
        string? search, Guid? expenseTypeId, string? status, IReadOnlyDictionary<Guid, string> expenseTypes)
    {
        var filters = new List<string>();
        if (search is not null) filters.Add($"Search: {search}");
        if (expenseTypeId.HasValue) filters.Add($"Expense type: {expenseTypes[expenseTypeId.Value]}");
        if (status is not null) filters.Add($"Status: {status}");
        return filters.Count == 0 ? "None" : string.Join(" • ", filters);
    }

    private static byte[] CreatePdf(MonthlyReport report) => Document.Create(document =>
    {
        document.Page(page =>
        {
            page.Size(PageSizes.Letter);
            page.Margin(36);
            page.DefaultTextStyle(style => style.FontSize(9));
            page.Header().Column(column =>
            {
                column.Item().Text("Turbo Fi monthly report").FontSize(20).SemiBold();
                column.Item().Text(report.Start.ToString("MMMM yyyy", CultureInfo.InvariantCulture)).FontSize(13);
                column.Item().Text($"Period: {report.Start:MMMM d, yyyy} – {report.End.AddDays(-1):MMMM d, yyyy}");
                column.Item().Text($"Generated: {report.GeneratedAt:MMMM d, yyyy h:mm tt} UTC");
                column.Item().Text($"Filters: {report.Filters}");
            });
            page.Content().PaddingTop(14).Column(column =>
            {
                column.Item().Row(row =>
                {
                    AddSummary(row, "Income", report.Income);
                    AddSummary(row, "Expenses", report.Expenses);
                    AddSummary(row, "Net", report.Net);
                });
                if (report.Sections.Count == 0)
                {
                    column.Item().PaddingTop(20).Text("No transactions match the selected month and filters.");
                    return;
                }

                foreach (var section in report.Sections)
                {
                    column.Item().PaddingTop(14).Text($"{section.Name} — {FormatMoney(section.Total)}").FontSize(12).SemiBold();
                    column.Item().PaddingTop(4).Table(table =>
                    {
                        table.ColumnsDefinition(columns =>
                        {
                            columns.ConstantColumn(78);
                            columns.RelativeColumn();
                            columns.ConstantColumn(88);
                        });
                        table.Header(header =>
                        {
                            header.Cell().Element(HeaderCell).Text("Date");
                            header.Cell().Element(HeaderCell).Text("Description/payee");
                            header.Cell().Element(HeaderCell).AlignRight().Text("Amount");
                        });
                        foreach (var transaction in section.Transactions)
                        {
                            table.Cell().Element(BodyCell).Text(transaction.Date.ToString("MMM d, yyyy", CultureInfo.InvariantCulture));
                            table.Cell().Element(BodyCell).Text(transaction.Description);
                            table.Cell().Element(BodyCell).AlignRight().Text(FormatMoney(transaction.Amount));
                        }
                    });
                }
            });
            page.Footer().AlignCenter().Text(text =>
            {
                text.Span("Turbo Fi • ");
                text.CurrentPageNumber();
                text.Span(" of ");
                text.TotalPages();
            });
        });
    }).GeneratePdf();

    private static void AddSummary(RowDescriptor row, string label, decimal amount) =>
        row.RelativeItem().Border(1).BorderColor(Colors.Grey.Lighten1).Padding(8).Column(column =>
        {
            column.Item().Text(label).FontSize(8).FontColor(Colors.Grey.Darken1);
            column.Item().Text(FormatMoney(amount)).FontSize(13).SemiBold();
        });

    private static IContainer HeaderCell(IContainer container) =>
        container.Background(Colors.Grey.Lighten2).PaddingVertical(4).PaddingHorizontal(3);

    private static IContainer BodyCell(IContainer container) =>
        container.BorderBottom(1).BorderColor(Colors.Grey.Lighten3).PaddingVertical(3).PaddingHorizontal(3);

    private static string FormatMoney(decimal amount) => amount.ToString("C2", CultureInfo.GetCultureInfo("en-US"));

    private static bool TryGetMonthRange(int? year, int? month, out DateOnly start, out DateOnly end)
    {
        var now = DateOnly.FromDateTime(DateTime.UtcNow);
        var selectedYear = year ?? now.Year;
        var selectedMonth = month ?? now.Month;
        if (selectedYear is < 1 or > 9999 || selectedMonth is < 1 or > 12)
        {
            start = end = default;
            return false;
        }
        start = new DateOnly(selectedYear, selectedMonth, 1);
        end = start.AddMonths(1);
        return true;
    }

    public sealed record GeneratedReport(byte[] Content, string FileName);

    private sealed record ReportCategory(Guid Id, string Name, Guid ExpenseTypeId);
    private sealed record ReportTransaction(DateOnly Date, string Description, decimal Amount, Guid? CategoryId, bool IsTransfer);
    private sealed record ReportSection(string Name, decimal Total, List<ReportTransaction> Transactions);
    private sealed record MonthlyReport(
        DateOnly Start, DateOnly End, DateTimeOffset GeneratedAt, string Filters,
        decimal Income, decimal Expenses, decimal Net, List<ReportSection> Sections);
}
