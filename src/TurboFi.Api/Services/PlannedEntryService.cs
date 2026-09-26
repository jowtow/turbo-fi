using Microsoft.EntityFrameworkCore;
using TurboFi.Api.Domain;
using TurboFi.Api.Infrastructure;
using TurboFi.Api.Models;

namespace TurboFi.Api.Services;

public sealed class PlannedEntryService(TurboFiDbContext db)
{
    public async Task<ServiceResult> GetPlannedEntriesAsync(Guid householdId, int year, int month)
    {
        if (!TryGetPlanMonth(year, month, out var planMonth))
            return ServiceResult.BadRequest("Provide a valid plan year and month.");

        var entries = await db.PlannedEntries
            .Where(entry => entry.HouseholdId == householdId && entry.PlanMonth == planMonth)
            .ToListAsync();

        if (entries.Count == 0)
        {
            var sourceMonth = await db.PlannedEntries
                .Where(entry => entry.HouseholdId == householdId && entry.PlanMonth < planMonth)
                .Select(entry => (DateOnly?)entry.PlanMonth)
                .OrderByDescending(entry => entry)
                .FirstOrDefaultAsync();

            if (sourceMonth is { } previousMonth)
            {
                var previousEntries = await db.PlannedEntries
                    .Where(entry => entry.HouseholdId == householdId && entry.PlanMonth == previousMonth)
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

        return ServiceResult.Ok(entries.Select(ToResponse).ToList());
    }

    public async Task<ServiceResult> CreatePlannedEntryAsync(Guid householdId, PlannedEntryRequest request)
    {
        if (request.Amount == 0) return ServiceResult.BadRequest("Amount cannot be zero.");
        if (!TryGetPlanMonth(request.Year, request.Month, out var planMonth))
            return ServiceResult.BadRequest("Provide a valid plan year and month.");

        var category = await db.Categories.SingleOrDefaultAsync(category =>
            category.Id == request.CategoryId && category.HouseholdId == householdId && !category.IsArchived);
        if (category is null) return ServiceResult.BadRequest("Category must belong to your household.");

        if (await db.PlannedEntries.AnyAsync(entry =>
                entry.HouseholdId == householdId && entry.CategoryId == request.CategoryId && entry.PlanMonth == planMonth))
            return ServiceResult.Conflict("This category already has a plan for the selected month.");

        var entry = new PlannedEntry
        {
            HouseholdId = householdId,
            FinancialAccountId = Guid.Empty,
            Name = category.Name,
            CategoryId = request.CategoryId,
            Amount = Math.Abs(request.Amount),
            PlanMonth = planMonth,
            IsFixed = request.IsFixed
        };
        db.PlannedEntries.Add(entry);
        await db.SaveChangesAsync();
        return ServiceResult.Created(ToResponse(entry));
    }

    public async Task<ServiceResult> UpdatePlannedEntryAsync(Guid householdId, Guid id, PlannedEntryUpdateRequest request)
    {
        if (request.Amount == 0) return ServiceResult.BadRequest("Amount cannot be zero.");
        var entry = await db.PlannedEntries.SingleOrDefaultAsync(item => item.Id == id && item.HouseholdId == householdId);
        if (entry is null) return ServiceResult.NotFound();

        entry.Amount = Math.Abs(request.Amount);
        entry.IsFixed = request.IsFixed;
        await db.SaveChangesAsync();
        return ServiceResult.Ok(ToResponse(entry));
    }

    public async Task<ServiceResult> DeletePlannedEntryAsync(Guid householdId, Guid id)
    {
        var entry = await db.PlannedEntries.SingleOrDefaultAsync(entry => entry.Id == id && entry.HouseholdId == householdId);
        if (entry is null) return ServiceResult.NotFound();

        db.PlannedEntries.Remove(entry);
        await db.SaveChangesAsync();
        return ServiceResult.NoContent();
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
