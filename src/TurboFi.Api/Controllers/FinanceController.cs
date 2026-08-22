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

    [HttpGet("expense-types")]
    public Task<List<ExpenseType>> ExpenseTypes() => db.ExpenseTypes
        .Where(type => type.HouseholdId == HouseholdId).OrderBy(type => type.Name).ToListAsync();

    [HttpPost("expense-types")]
    public async Task<ActionResult<ExpenseType>> CreateExpenseType(ExpenseTypeRequest request)
    {
        var name = request.Name.Trim();
        if (string.IsNullOrWhiteSpace(name)) return BadRequest("Expense type name is required.");
        if (await db.ExpenseTypes.AnyAsync(type => type.HouseholdId == HouseholdId && type.Name == name))
            return Conflict("An expense type with that name already exists.");

        var type = new ExpenseType { HouseholdId = HouseholdId, Name = name };
        db.ExpenseTypes.Add(type);
        await db.SaveChangesAsync();
        return Created($"api/expense-types/{type.Id}", type);
    }

    [HttpPut("expense-types/{id:guid}")]
    public async Task<ActionResult<ExpenseType>> UpdateExpenseType(Guid id, ExpenseTypeRequest request)
    {
        var type = await db.ExpenseTypes.SingleOrDefaultAsync(item => item.Id == id && item.HouseholdId == HouseholdId);
        if (type is null) return NotFound();
        if (type.Name == ExpenseTypeDefaults.Uncategorized)
            return Conflict("The Uncategorized expense type cannot be renamed.");

        var name = request.Name.Trim();
        if (string.IsNullOrWhiteSpace(name)) return BadRequest("Expense type name is required.");
        if (await db.ExpenseTypes.AnyAsync(item => item.HouseholdId == HouseholdId && item.Name == name && item.Id != id))
            return Conflict("An expense type with that name already exists.");

        type.Name = name;
        await db.SaveChangesAsync();
        return Ok(type);
    }

    [HttpDelete("expense-types/{id:guid}")]
    public async Task<ActionResult> DeleteExpenseType(Guid id)
    {
        var type = await db.ExpenseTypes.SingleOrDefaultAsync(item => item.Id == id && item.HouseholdId == HouseholdId);
        if (type is null) return NotFound();
        if (type.Name == ExpenseTypeDefaults.Uncategorized)
            return Conflict("The Uncategorized expense type cannot be deleted.");
        if (await db.Categories.AnyAsync(category => category.ExpenseTypeId == id))
            return Conflict("Reassign or delete this expense type's categories first.");

        db.ExpenseTypes.Remove(type);
        await db.SaveChangesAsync();
        return NoContent();
    }

    [HttpGet("categories")]
    public Task<List<Category>> Categories() => db.Categories
        .Where(category => category.HouseholdId == HouseholdId).OrderBy(category => category.Name).ToListAsync();

    [HttpPost("categories")]
    public async Task<ActionResult<Category>> CreateCategory(CategoryRequest request)
    {
        var name = request.Name.Trim();
        if (string.IsNullOrWhiteSpace(name)) return BadRequest("Category name is required.");
        if (!await db.ExpenseTypes.AnyAsync(type => type.Id == request.ExpenseTypeId && type.HouseholdId == HouseholdId))
            return BadRequest("Expense type must belong to your household.");
        if (await db.Categories.AnyAsync(category => category.HouseholdId == HouseholdId && category.Name == name))
            return Conflict("A category with that name already exists.");

        var category = new Category
        {
            HouseholdId = HouseholdId,
            ExpenseTypeId = request.ExpenseTypeId,
            Name = name,
            Color = request.Color?.Trim()
        };
        db.Categories.Add(category);
        await db.SaveChangesAsync();
        return Created($"api/categories/{category.Id}", category);
    }

    [HttpPut("categories/{id:guid}")]
    public async Task<ActionResult<Category>> UpdateCategory(Guid id, CategoryRequest request)
    {
        var category = await db.Categories.SingleOrDefaultAsync(item => item.Id == id && item.HouseholdId == HouseholdId);
        if (category is null) return NotFound();

        var name = request.Name.Trim();
        if (string.IsNullOrWhiteSpace(name)) return BadRequest("Category name is required.");
        if (!await db.ExpenseTypes.AnyAsync(type => type.Id == request.ExpenseTypeId && type.HouseholdId == HouseholdId))
            return BadRequest("Expense type must belong to your household.");
        if (await db.Categories.AnyAsync(item => item.HouseholdId == HouseholdId && item.Name == name && item.Id != id))
            return Conflict("A category with that name already exists.");

        category.Name = name;
        category.ExpenseTypeId = request.ExpenseTypeId;
        category.Color = request.Color?.Trim();
        category.IsArchived = request.IsArchived;
        await db.SaveChangesAsync();
        return Ok(category);
    }

    [HttpDelete("categories/{id:guid}")]
    public async Task<ActionResult> DeleteCategory(Guid id)
    {
        var category = await db.Categories.SingleOrDefaultAsync(item => item.Id == id && item.HouseholdId == HouseholdId);
        if (category is null) return NotFound();

        var plans = await db.PlannedEntries.Where(entry => entry.HouseholdId == HouseholdId && entry.CategoryId == id).ToListAsync();
        var transactions = await db.FinancialTransactions
            .Where(transaction => transaction.HouseholdId == HouseholdId && transaction.CategoryId == id)
            .ToListAsync();
        foreach (var transaction in transactions)
        {
            transaction.CategoryId = null;
            transaction.ReviewedAt = null;
        }
        db.PlannedEntries.RemoveRange(plans);
        db.Categories.Remove(category);
        await db.SaveChangesAsync();
        return NoContent();
    }

    [HttpGet("planned-entries")]
    public async Task<ActionResult<List<PlannedEntryResponse>>> PlannedEntries([FromQuery] int year, [FromQuery] int month)
    {
        if (!TryGetPlanMonth(year, month, out var planMonth)) return BadRequest("Provide a valid plan year and month.");
        var entries = await db.PlannedEntries
            .Where(entry => entry.HouseholdId == HouseholdId && entry.PlanMonth == planMonth)
            .ToListAsync();
        if (entries.Count == 0)
        {
            var sourceMonth = await db.PlannedEntries
                .Where(entry => entry.HouseholdId == HouseholdId && entry.PlanMonth < planMonth)
                .Select(entry => (DateOnly?)entry.PlanMonth)
                .OrderByDescending(entry => entry)
                .FirstOrDefaultAsync();
            if (sourceMonth is { } previousMonth)
            {
                var previousEntries = await db.PlannedEntries
                    .Where(entry => entry.HouseholdId == HouseholdId && entry.PlanMonth == previousMonth)
                    .ToListAsync();
                entries = previousEntries.Select(entry => new PlannedEntry
                {
                    HouseholdId = entry.HouseholdId,
                    FinancialAccountId = entry.FinancialAccountId,
                    CategoryId = entry.CategoryId,
                    Name = entry.Name,
                    Amount = entry.Amount,
                    PlanMonth = planMonth,
                    IsFixed = entry.IsFixed,
                    IsActive = entry.IsActive
                }).ToList();
                db.PlannedEntries.AddRange(entries);
                await db.SaveChangesAsync();
            }
        }
        return entries.Select(ToResponse).ToList();
    }

    [HttpPost("planned-entries")]
    public async Task<ActionResult<PlannedEntryResponse>> CreatePlannedEntry(PlannedEntryRequest request)
    {
        if (request.Amount == 0) return BadRequest("Amount cannot be zero.");
        if (!TryGetPlanMonth(request.Year, request.Month, out var planMonth)) return BadRequest("Provide a valid plan year and month.");
        var category = await db.Categories.SingleOrDefaultAsync(category =>
            category.Id == request.CategoryId && category.HouseholdId == HouseholdId && !category.IsArchived);
        if (category is null) return BadRequest("Category must belong to your household.");
        if (await db.PlannedEntries.AnyAsync(entry => entry.HouseholdId == HouseholdId && entry.CategoryId == request.CategoryId && entry.PlanMonth == planMonth))
            return Conflict("This category already has a plan for the selected month.");

        var entry = new PlannedEntry
        {
            HouseholdId = HouseholdId,
            // These legacy columns are retained for existing EnsureCreated databases; plans are category-level.
            FinancialAccountId = Guid.Empty, Name = category.Name, CategoryId = request.CategoryId,
            Amount = Math.Abs(request.Amount), PlanMonth = planMonth, IsFixed = request.IsFixed
        };
        db.PlannedEntries.Add(entry);
        await db.SaveChangesAsync();
        return Created($"api/planned-entries/{entry.Id}", ToResponse(entry));
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

    [HttpPut("planned-entries/{id:guid}")]
    public async Task<ActionResult<PlannedEntryResponse>> UpdatePlannedEntry(Guid id, PlannedEntryUpdateRequest request)
    {
        if (request.Amount == 0) return BadRequest("Amount cannot be zero.");
        var entry = await db.PlannedEntries.SingleOrDefaultAsync(item => item.Id == id && item.HouseholdId == HouseholdId);
        if (entry is null) return NotFound();

        entry.Amount = Math.Abs(request.Amount);
        entry.IsFixed = request.IsFixed;
        await db.SaveChangesAsync();
        return Ok(ToResponse(entry));
    }

    [HttpGet("dashboard")]
    public async Task<ActionResult> Dashboard([FromQuery] int? year, [FromQuery] int? month)
    {
        var now = DateOnly.FromDateTime(DateTime.UtcNow);
        var start = new DateOnly(year ?? now.Year, month ?? now.Month, 1);
        var end = start.AddMonths(1);
        var planned = await db.PlannedEntries.Where(entry => entry.HouseholdId == HouseholdId && entry.PlanMonth == start && entry.IsActive)
            .GroupBy(entry => entry.CategoryId)
            .Select(group => new { CategoryId = group.Key, Planned = group.Sum(entry => Math.Abs(entry.Amount)), IsFixed = group.All(entry => entry.IsFixed) }).ToListAsync();
        var actual = await db.FinancialTransactions.Where(transaction => transaction.HouseholdId == HouseholdId
                && !transaction.IsTransfer && transaction.CategoryId != null && transaction.Amount < 0
                && transaction.TransactionDate >= start && transaction.TransactionDate < end)
            .GroupBy(transaction => transaction.CategoryId!.Value)
            .Select(group => new { CategoryId = group.Key, Actual = group.Sum(transaction => -transaction.Amount) }).ToListAsync();
        var categories = await db.Categories
            .Where(category => category.HouseholdId == HouseholdId)
            .ToDictionaryAsync(category => category.Id);
        var expenseTypes = await db.ExpenseTypes
            .Where(type => type.HouseholdId == HouseholdId)
            .ToDictionaryAsync(type => type.Id, type => type.Name);
        var categoryTotals = planned.Select(item => item.CategoryId).Union(actual.Select(item => item.CategoryId)).Select(id =>
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
        var expenseTypeTotals = categoryTotals.GroupBy(item => item.expenseTypeId).Select(group => new
        {
            expenseTypeId = group.Key,
            name = expenseTypes.GetValueOrDefault(group.Key, ExpenseTypeDefaults.Uncategorized),
            planned = group.Sum(item => item.planned),
            actual = group.Sum(item => item.actual),
            categories = group
                .OrderByDescending(item => Math.Max(item.actual, item.planned))
                .ThenBy(item => item.name)
        }).OrderByDescending(item => item.actual).ThenBy(item => item.name);
        var reviewCount = await db.FinancialTransactions.CountAsync(transaction =>
            transaction.HouseholdId == HouseholdId && !transaction.IsTransfer && transaction.CategoryId == null);
        return Ok(new { month = start.ToString("yyyy-MM"), reviewCount, expenseTypes = expenseTypeTotals });
    }

    private static PlannedEntryResponse ToResponse(PlannedEntry entry) =>
        new(entry.Id, entry.CategoryId, entry.Amount, entry.IsFixed);

    private static bool TryGetPlanMonth(int year, int month, out DateOnly planMonth)
    {
        planMonth = default;
        if (year is < 2000 or > 9999 || month is < 1 or > 12) return false;
        planMonth = new DateOnly(year, month, 1);
        return true;
    }
}

public sealed record AccountRequest(string Name, string? Institution, string? LastFour);
public sealed record ExpenseTypeRequest(string Name);
public sealed record CategoryRequest(string Name, Guid ExpenseTypeId, string? Color = null, bool IsArchived = false);
public sealed record PlannedEntryRequest(Guid CategoryId, decimal Amount, int Year, int Month, bool IsFixed = false);
public sealed record PlannedEntryUpdateRequest(decimal Amount, bool IsFixed);
public sealed record PlannedEntryResponse(Guid Id, Guid CategoryId, decimal Amount, bool IsFixed);
