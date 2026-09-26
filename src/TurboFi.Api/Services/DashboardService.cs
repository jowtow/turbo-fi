using Microsoft.EntityFrameworkCore;
using TurboFi.Api.Domain;
using TurboFi.Api.Infrastructure;

namespace TurboFi.Api.Services;

public sealed class DashboardService(TurboFiDbContext db)
{
    public async Task<ServiceResult> GetDashboardAsync(Guid householdId, int? year, int? month)
    {
        var now = DateOnly.FromDateTime(DateTime.UtcNow);
        var start = new DateOnly(year ?? now.Year, month ?? now.Month, 1);
        var end = start.AddMonths(1);

        var planned = await db.PlannedEntries
            .Where(entry => entry.HouseholdId == householdId && entry.PlanMonth == start && entry.IsActive)
            .GroupBy(entry => entry.CategoryId)
            .Select(group => new
            {
                CategoryId = group.Key,
                Planned = group.Sum(entry => Math.Abs(entry.Amount)),
                IsFixed = group.All(entry => entry.IsFixed)
            })
            .ToListAsync();

        var actual = await db.FinancialTransactions
            .Where(transaction => transaction.HouseholdId == householdId
                && !transaction.IsTransfer && transaction.CategoryId != null && transaction.Amount < 0
                && transaction.TransactionDate >= start && transaction.TransactionDate < end)
            .GroupBy(transaction => transaction.CategoryId!.Value)
            .Select(group => new { CategoryId = group.Key, Actual = group.Sum(transaction => -transaction.Amount) })
            .ToListAsync();

        var categories = await db.Categories
            .Where(category => category.HouseholdId == householdId)
            .ToDictionaryAsync(category => category.Id);

        var expenseTypes = await db.ExpenseTypes
            .Where(type => type.HouseholdId == householdId)
            .ToDictionaryAsync(type => type.Id, type => type.Name);

        var categoryTotals = planned.Select(item => item.CategoryId)
            .Union(actual.Select(item => item.CategoryId))
            .Select(id =>
            {
                var category = categories.GetValueOrDefault(id);
                var expenseTypeId = category?.ExpenseTypeId ?? Guid.Empty;
                return new
                {
                    categoryId = id,
                    expenseTypeId,
                    name = category?.Name ?? ExpenseTypeDefaults.Uncategorized,
                    planned = planned.FirstOrDefault(item => item.CategoryId == id)?.Planned ?? 0m,
                    actual = actual.FirstOrDefault(item => item.CategoryId == id)?.Actual ?? 0m,
                    isFixed = planned.FirstOrDefault(item => item.CategoryId == id)?.IsFixed ?? false
                };
            });

        var expenseTypeTotals = categoryTotals
            .GroupBy(item => item.expenseTypeId)
            .Select(group => new
            {
                expenseTypeId = group.Key,
                name = expenseTypes.GetValueOrDefault(group.Key, ExpenseTypeDefaults.Uncategorized),
                planned = group.Sum(item => item.planned),
                actual = group.Sum(item => item.actual),
                categories = group
                    .OrderByDescending(item => Math.Max(item.actual, item.planned))
                    .ThenBy(item => item.name)
            })
            .OrderByDescending(item => item.actual)
            .ThenBy(item => item.name);

        var reviewCount = await db.FinancialTransactions.CountAsync(transaction =>
            transaction.HouseholdId == householdId && !transaction.IsTransfer && transaction.CategoryId == null);

        return ServiceResult.Ok(new { month = start.ToString("yyyy-MM"), reviewCount, expenseTypes = expenseTypeTotals });
    }

    public async Task<ServiceResult> GetBurndownAsync(
        Guid householdId, int? year, int? month, Guid? expenseTypeId, Guid? categoryId)
    {
        var now = DateOnly.FromDateTime(DateTime.UtcNow);
        var start = new DateOnly(year ?? now.Year, month ?? now.Month, 1);
        var end = start.AddMonths(1);
        var daysInMonth = DateTime.DaysInMonth(start.Year, start.Month);

        var plannedQuery = db.PlannedEntries
            .Where(e => e.HouseholdId == householdId && e.PlanMonth == start && e.IsActive);
        if (categoryId.HasValue)
            plannedQuery = plannedQuery.Where(e => e.CategoryId == categoryId.Value);
        else if (expenseTypeId.HasValue)
        {
            var categoryIds = await db.Categories
                .Where(c => c.HouseholdId == householdId && c.ExpenseTypeId == expenseTypeId.Value)
                .Select(c => c.Id).ToListAsync();
            plannedQuery = plannedQuery.Where(e => categoryIds.Contains(e.CategoryId));
        }
        var totalPlanned = await plannedQuery.SumAsync(e => (decimal?)Math.Abs(e.Amount)) ?? 0m;

        var txQuery = db.FinancialTransactions.Where(t =>
            t.HouseholdId == householdId && !t.IsTransfer && t.CategoryId != null &&
            t.Amount < 0 && t.TransactionDate >= start && t.TransactionDate < end);
        if (categoryId.HasValue)
            txQuery = txQuery.Where(t => t.CategoryId == categoryId.Value);
        else if (expenseTypeId.HasValue)
        {
            var categoryIds = await db.Categories
                .Where(c => c.HouseholdId == householdId && c.ExpenseTypeId == expenseTypeId.Value)
                .Select(c => c.Id).ToListAsync();
            txQuery = txQuery.Where(t => t.CategoryId.HasValue && categoryIds.Contains(t.CategoryId.Value));
        }

        var dailyActuals = await txQuery
            .GroupBy(t => t.TransactionDate.Day)
            .Select(g => new { Day = g.Key, Amount = g.Sum(t => -t.Amount) })
            .ToListAsync();
        var actualByDay = dailyActuals.ToDictionary(d => d.Day, d => d.Amount);

        var cutoffDay = start.Year == now.Year && start.Month == now.Month ? now.Day : daysInMonth;
        var cumulativeActual = 0m;
        var points = Enumerable.Range(1, daysInMonth).Select(day =>
        {
            if (actualByDay.TryGetValue(day, out var dayAmount)) cumulativeActual += dayAmount;
            var plannedPoint = Math.Round(totalPlanned / daysInMonth * day, 2);
            return new { day, planned = plannedPoint, actual = day <= cutoffDay ? (decimal?)Math.Round(cumulativeActual, 2) : null };
        });

        return ServiceResult.Ok(points);
    }
}
