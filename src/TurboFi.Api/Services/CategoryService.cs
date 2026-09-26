using Microsoft.EntityFrameworkCore;
using TurboFi.Api.Domain;
using TurboFi.Api.Infrastructure;
using TurboFi.Api.Models;

namespace TurboFi.Api.Services;

public sealed class CategoryService(TurboFiDbContext db)
{
    public Task<List<Category>> GetCategoriesAsync(Guid householdId) =>
        db.Categories
            .Where(category => category.HouseholdId == householdId)
            .OrderBy(category => category.Name)
            .ToListAsync();

    public async Task<ServiceResult> CreateCategoryAsync(Guid householdId, CategoryRequest request)
    {
        var name = request.Name.Trim();
        if (string.IsNullOrWhiteSpace(name)) return ServiceResult.BadRequest("Category name is required.");
        if (!await db.ExpenseTypes.AnyAsync(type => type.Id == request.ExpenseTypeId && type.HouseholdId == householdId))
            return ServiceResult.BadRequest("Expense type must belong to your household.");
        if (await db.Categories.AnyAsync(category => category.HouseholdId == householdId && category.Name == name))
            return ServiceResult.Conflict("A category with that name already exists.");

        var category = new Category
        {
            HouseholdId = householdId,
            ExpenseTypeId = request.ExpenseTypeId,
            Name = name,
            Color = request.Color?.Trim()
        };
        db.Categories.Add(category);
        await db.SaveChangesAsync();
        return ServiceResult.Created(category);
    }

    public async Task<ServiceResult> UpdateCategoryAsync(Guid householdId, Guid id, CategoryRequest request)
    {
        var category = await db.Categories.SingleOrDefaultAsync(item => item.Id == id && item.HouseholdId == householdId);
        if (category is null) return ServiceResult.NotFound();

        var name = request.Name.Trim();
        if (string.IsNullOrWhiteSpace(name)) return ServiceResult.BadRequest("Category name is required.");
        if (!await db.ExpenseTypes.AnyAsync(type => type.Id == request.ExpenseTypeId && type.HouseholdId == householdId))
            return ServiceResult.BadRequest("Expense type must belong to your household.");
        if (await db.Categories.AnyAsync(item => item.HouseholdId == householdId && item.Name == name && item.Id != id))
            return ServiceResult.Conflict("A category with that name already exists.");

        category.Name = name;
        category.ExpenseTypeId = request.ExpenseTypeId;
        category.Color = request.Color?.Trim();
        category.IsArchived = request.IsArchived;
        await db.SaveChangesAsync();
        return ServiceResult.Ok(category);
    }

    public async Task<ServiceResult> DeleteCategoryAsync(Guid householdId, Guid id)
    {
        var category = await db.Categories.SingleOrDefaultAsync(item => item.Id == id && item.HouseholdId == householdId);
        if (category is null) return ServiceResult.NotFound();

        var plans = await db.PlannedEntries
            .Where(entry => entry.HouseholdId == householdId && entry.CategoryId == id)
            .ToListAsync();
        var transactions = await db.FinancialTransactions
            .Where(transaction => transaction.HouseholdId == householdId && transaction.CategoryId == id)
            .ToListAsync();

        foreach (var transaction in transactions)
        {
            transaction.CategoryId = null;
            transaction.ReviewedAt = null;
        }
        db.PlannedEntries.RemoveRange(plans);
        db.Categories.Remove(category);
        await db.SaveChangesAsync();
        return ServiceResult.NoContent();
    }
}
