using Microsoft.EntityFrameworkCore;
using TurboFi.Api.Domain;
using TurboFi.Api.Infrastructure;
using TurboFi.Api.Models;

namespace TurboFi.Api.Services;

public sealed class ExpenseTypeService(TurboFiDbContext db)
{
    public Task<List<ExpenseType>> GetExpenseTypesAsync(Guid householdId) =>
        db.ExpenseTypes
            .Where(type => type.HouseholdId == householdId)
            .OrderBy(type => type.Name)
            .ToListAsync();

    public async Task<ServiceResult> CreateExpenseTypeAsync(Guid householdId, ExpenseTypeRequest request)
    {
        var name = request.Name.Trim();
        if (string.IsNullOrWhiteSpace(name)) return ServiceResult.BadRequest("Expense type name is required.");
        if (await db.ExpenseTypes.AnyAsync(type => type.HouseholdId == householdId && type.Name == name))
            return ServiceResult.Conflict("An expense type with that name already exists.");

        var type = new ExpenseType { HouseholdId = householdId, Name = name };
        db.ExpenseTypes.Add(type);
        await db.SaveChangesAsync();
        return ServiceResult.Created(type);
    }

    public async Task<ServiceResult> UpdateExpenseTypeAsync(Guid householdId, Guid id, ExpenseTypeRequest request)
    {
        var type = await db.ExpenseTypes.SingleOrDefaultAsync(item => item.Id == id && item.HouseholdId == householdId);
        if (type is null) return ServiceResult.NotFound();
        if (type.Name == ExpenseTypeDefaults.Uncategorized)
            return ServiceResult.Conflict("The Uncategorized expense type cannot be renamed.");

        var name = request.Name.Trim();
        if (string.IsNullOrWhiteSpace(name)) return ServiceResult.BadRequest("Expense type name is required.");
        if (await db.ExpenseTypes.AnyAsync(item => item.HouseholdId == householdId && item.Name == name && item.Id != id))
            return ServiceResult.Conflict("An expense type with that name already exists.");

        type.Name = name;
        await db.SaveChangesAsync();
        return ServiceResult.Ok(type);
    }

    public async Task<ServiceResult> DeleteExpenseTypeAsync(Guid householdId, Guid id)
    {
        var type = await db.ExpenseTypes.SingleOrDefaultAsync(item => item.Id == id && item.HouseholdId == householdId);
        if (type is null) return ServiceResult.NotFound();
        if (type.Name == ExpenseTypeDefaults.Uncategorized)
            return ServiceResult.Conflict("The Uncategorized expense type cannot be deleted.");
        if (await db.Categories.AnyAsync(category => category.ExpenseTypeId == id))
            return ServiceResult.Conflict("Reassign or delete this expense type's categories first.");

        db.ExpenseTypes.Remove(type);
        await db.SaveChangesAsync();
        return ServiceResult.NoContent();
    }
}
