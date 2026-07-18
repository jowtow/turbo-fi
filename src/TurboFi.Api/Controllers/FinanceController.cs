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
    public Task<List<PlannedEntry>> PlannedEntries() => db.PlannedEntries
        .Where(entry => entry.HouseholdId == HouseholdId).OrderBy(entry => entry.DayOfMonth).ToListAsync();

    [HttpPost("planned-entries")]
    public async Task<ActionResult<PlannedEntry>> CreatePlannedEntry(PlannedEntryRequest request)
    {
        if (request.DayOfMonth is < 1 or > 31) return BadRequest("Day of month must be between 1 and 31.");
        if (!await db.FinancialAccounts.AnyAsync(account => account.Id == request.FinancialAccountId && account.HouseholdId == HouseholdId)
            || !await db.Categories.AnyAsync(category => category.Id == request.CategoryId && category.HouseholdId == HouseholdId))
            return BadRequest("Account and category must belong to your household.");

        var entry = new PlannedEntry
        {
            HouseholdId = HouseholdId, FinancialAccountId = request.FinancialAccountId, CategoryId = request.CategoryId,
            Name = request.Name.Trim(), Amount = request.Amount, DayOfMonth = request.DayOfMonth
        };
        db.PlannedEntries.Add(entry);
        await db.SaveChangesAsync();
        return Created($"api/planned-entries/{entry.Id}", entry);
    }

    [HttpGet("dashboard")]
    public async Task<ActionResult> Dashboard([FromQuery] int? year, [FromQuery] int? month)
    {
        var now = DateOnly.FromDateTime(DateTime.UtcNow);
        var start = new DateOnly(year ?? now.Year, month ?? now.Month, 1);
        var end = start.AddMonths(1);
        var planned = await db.PlannedEntries.Where(entry => entry.HouseholdId == HouseholdId && entry.IsActive)
            .GroupBy(entry => entry.CategoryId)
            .Select(group => new { CategoryId = group.Key, Planned = group.Sum(entry => entry.Amount) }).ToListAsync();
        var actual = await db.FinancialTransactions.Where(transaction => transaction.HouseholdId == HouseholdId
                && transaction.CategoryId != null && transaction.TransactionDate >= start && transaction.TransactionDate < end)
            .GroupBy(transaction => transaction.CategoryId!.Value)
            .Select(group => new { CategoryId = group.Key, Actual = group.Sum(transaction => transaction.Amount) }).ToListAsync();
        var categories = await db.Categories.Where(category => category.HouseholdId == HouseholdId).ToDictionaryAsync(category => category.Id, category => category.Name);
        var categoryTotals = planned.Select(item => item.CategoryId).Union(actual.Select(item => item.CategoryId)).Select(id => new
        {
            categoryId = id,
            name = categories.GetValueOrDefault(id, "Uncategorized"),
            planned = planned.FirstOrDefault(item => item.CategoryId == id)?.Planned ?? 0m,
            actual = actual.FirstOrDefault(item => item.CategoryId == id)?.Actual ?? 0m
        }).OrderBy(item => item.name);
        var reviewCount = await db.FinancialTransactions.CountAsync(transaction => transaction.HouseholdId == HouseholdId && transaction.CategoryId == null);
        return Ok(new { month = start.ToString("yyyy-MM"), reviewCount, categories = categoryTotals });
    }
}

public sealed record AccountRequest(string Name, string? Institution, string? LastFour);
public sealed record CategoryRequest(string Name, string? Color);
public sealed record PlannedEntryRequest(string Name, Guid FinancialAccountId, Guid CategoryId, decimal Amount, int DayOfMonth);
