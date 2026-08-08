using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TurboFi.Api.Domain;
using TurboFi.Api.Infrastructure;

namespace TurboFi.Api.Controllers;

[ApiController]
[Authorize]
[Route("api")]
public sealed class FinanceController(TurboFiDbContext db) : ControllerBase
{
    private Guid HouseholdId => Guid.Parse(User.FindFirstValue("householdId")
        ?? throw new InvalidOperationException("The signed-in user has no household."));

    [HttpGet("accounts")]
    public Task<List<FinancialAccount>> Accounts() => db.FinancialAccounts
        .Where(account => account.HouseholdId == HouseholdId).OrderBy(account => account.Name).ToListAsync();

    [HttpPost("accounts")]
    public async Task<ActionResult<FinancialAccount>> CreateAccount(AccountRequest request)
    {
        var account = new FinancialAccount { HouseholdId = HouseholdId, Name = request.Name.Trim(), Institution = request.Institution?.Trim(), LastFour = request.LastFour?.Trim() };
        db.FinancialAccounts.Add(account);
        await db.SaveChangesAsync();
        return Created($"api/accounts/{account.Id}", account);
    }

    [HttpGet("categories")]
    public Task<List<Category>> Categories() => db.Categories
        .Where(category => category.HouseholdId == HouseholdId).OrderBy(category => category.Name).ToListAsync();

    [HttpPost("categories")]
    public async Task<ActionResult<Category>> CreateCategory(CategoryRequest request)
    {
        var category = new Category { HouseholdId = HouseholdId, Name = request.Name.Trim(), Color = request.Color?.Trim() };
        db.Categories.Add(category);
        await db.SaveChangesAsync();
        return Created($"api/categories/{category.Id}", category);
    }

    [HttpGet("planned-entries")]
    public Task<List<PlannedEntryResponse>> PlannedEntries() => db.PlannedEntries
        .Where(entry => entry.HouseholdId == HouseholdId).OrderBy(entry => entry.DayOfMonth)
        .Select(entry => new PlannedEntryResponse(entry.Id, entry.CategoryId, entry.Amount, entry.DayOfMonth, entry.IsFixed))
        .ToListAsync();

    [HttpPost("planned-entries")]
    public async Task<ActionResult<PlannedEntryResponse>> CreatePlannedEntry(PlannedEntryRequest request)
    {
        if (request.Amount == 0) return BadRequest("Amount cannot be zero.");
        if (request.DayOfMonth is < 1 or > 31) return BadRequest("Day of month must be between 1 and 31.");
        var category = await db.Categories.SingleOrDefaultAsync(category => category.Id == request.CategoryId && category.HouseholdId == HouseholdId);
        if (category is null) return BadRequest("Category must belong to your household.");
        if (await db.PlannedEntries.AnyAsync(entry => entry.HouseholdId == HouseholdId && entry.CategoryId == request.CategoryId))
            return Conflict("This category already has a monthly plan.");

        var entry = new PlannedEntry
        {
            HouseholdId = HouseholdId,
            // These legacy columns are retained for existing EnsureCreated databases; plans are category-level.
            FinancialAccountId = Guid.Empty, Name = category.Name, CategoryId = request.CategoryId,
            Amount = Math.Abs(request.Amount), DayOfMonth = request.DayOfMonth, IsFixed = request.IsFixed
        };
        db.PlannedEntries.Add(entry);
        await db.SaveChangesAsync();
        return Created($"api/planned-entries/{entry.Id}", new PlannedEntryResponse(entry.Id, entry.CategoryId, entry.Amount, entry.DayOfMonth, entry.IsFixed));
    }

    [HttpDelete("planned-entries/{id:guid}")]
    public async Task<ActionResult> DeletePlannedEntry(Guid id)
    {
        var entry = await db.PlannedEntries.SingleOrDefaultAsync(entry => entry.Id == id && entry.HouseholdId == HouseholdId);
        if (entry is null) return NotFound();

        db.PlannedEntries.Remove(entry);
        await db.SaveChangesAsync();
        return NoContent();
    }

    [HttpGet("dashboard")]
    public async Task<ActionResult> Dashboard([FromQuery] int? year, [FromQuery] int? month)
    {
        var now = DateOnly.FromDateTime(DateTime.UtcNow);
        var start = new DateOnly(year ?? now.Year, month ?? now.Month, 1);
        var end = start.AddMonths(1);
        var planSchedule = await db.PlannedEntries.Where(entry => entry.HouseholdId == HouseholdId && entry.IsActive)
            .Select(entry => new { Amount = Math.Abs(entry.Amount), entry.DayOfMonth }).ToListAsync();
        var planned = await db.PlannedEntries.Where(entry => entry.HouseholdId == HouseholdId && entry.IsActive)
            .GroupBy(entry => entry.CategoryId)
            .Select(group => new { CategoryId = group.Key, Planned = group.Sum(entry => Math.Abs(entry.Amount)), DayOfMonth = group.Min(entry => entry.DayOfMonth), IsFixed = group.All(entry => entry.IsFixed) }).ToListAsync();
        var actual = await db.FinancialTransactions.Where(transaction => transaction.HouseholdId == HouseholdId
                && !transaction.IsTransfer && transaction.CategoryId != null && transaction.Amount < 0
                && transaction.TransactionDate >= start && transaction.TransactionDate < end)
            .GroupBy(transaction => transaction.CategoryId!.Value)
            .Select(group => new { CategoryId = group.Key, Actual = group.Sum(transaction => -transaction.Amount) }).ToListAsync();
        var categories = await db.Categories.Where(category => category.HouseholdId == HouseholdId).ToDictionaryAsync(category => category.Id, category => category.Name);
        var categoryTotals = planned.Select(item => item.CategoryId).Union(actual.Select(item => item.CategoryId)).Select(id => new
        {
            categoryId = id,
            name = categories.GetValueOrDefault(id, "Uncategorized"),
            planned = planned.FirstOrDefault(item => item.CategoryId == id)?.Planned ?? 0m,
            actual = actual.FirstOrDefault(item => item.CategoryId == id)?.Actual ?? 0m,
            dayOfMonth = planned.FirstOrDefault(item => item.CategoryId == id)?.DayOfMonth ?? 1,
            isFixed = planned.FirstOrDefault(item => item.CategoryId == id)?.IsFixed ?? false
        }).OrderBy(item => item.name);
        var reviewCount = await db.FinancialTransactions.CountAsync(transaction =>
            transaction.HouseholdId == HouseholdId && !transaction.IsTransfer && transaction.CategoryId == null);
        var dailyActuals = await db.FinancialTransactions.Where(transaction => transaction.HouseholdId == HouseholdId
                && !transaction.IsTransfer && transaction.CategoryId != null && transaction.Amount < 0
                && transaction.TransactionDate >= start && transaction.TransactionDate < end)
            .GroupBy(transaction => transaction.TransactionDate)
            .Select(group => new { Day = group.Key.Day, Actual = group.Sum(transaction => -transaction.Amount) })
            .ToDictionaryAsync(item => item.Day, item => item.Actual);
        var daysInMonth = DateTime.DaysInMonth(start.Year, start.Month);
        var burndown = Enumerable.Range(1, daysInMonth).Select(day => new
        {
            day,
            planned = planSchedule.Where(entry => Math.Min(entry.DayOfMonth, daysInMonth) <= day).Sum(entry => entry.Amount),
            actual = Enumerable.Range(1, day).Sum(actualDay => dailyActuals.GetValueOrDefault(actualDay))
        });
        return Ok(new { month = start.ToString("yyyy-MM"), reviewCount, categories = categoryTotals, burndown });
    }
}

public sealed record AccountRequest(string Name, string? Institution, string? LastFour);
public sealed record CategoryRequest(string Name, string? Color);
public sealed record PlannedEntryRequest(Guid CategoryId, decimal Amount, int DayOfMonth, bool IsFixed = false);
public sealed record PlannedEntryResponse(Guid Id, Guid CategoryId, decimal Amount, int DayOfMonth, bool IsFixed);
