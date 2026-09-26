using Microsoft.EntityFrameworkCore;
using TurboFi.Api.Domain;
using TurboFi.Api.Infrastructure;
using TurboFi.Api.Models;

namespace TurboFi.Api.Services;

public sealed class PhraseRuleService(TurboFiDbContext db)
{
    public async Task<ServiceResult> GetPhraseRulesAsync(Guid householdId)
    {
        var rules = await db.CategoryPhraseRules
            .Where(rule => rule.HouseholdId == householdId)
            .OrderBy(rule => rule.Phrase)
            .Select(rule => new { rule.Id, rule.Phrase, rule.CategoryId })
            .ToListAsync();
        return ServiceResult.Ok(rules);
    }

    public async Task<ServiceResult> CreatePhraseRuleAsync(Guid householdId, PhraseRuleRequest request)
    {
        var phrase = request.Phrase.Trim();
        if (string.IsNullOrWhiteSpace(phrase)) return ServiceResult.BadRequest("Phrase is required.");
        if (phrase.Length > 200) return ServiceResult.BadRequest("Phrase cannot exceed 200 characters.");
        if (!await db.Categories.AnyAsync(category =>
                category.Id == request.CategoryId && category.HouseholdId == householdId && !category.IsArchived))
            return ServiceResult.BadRequest("Unknown or archived category.");
        if (await db.CategoryPhraseRules.AnyAsync(rule => rule.HouseholdId == householdId && rule.Phrase == phrase))
            return ServiceResult.Conflict("A phrase rule for that phrase already exists.");

        var rule = new CategoryPhraseRule { HouseholdId = householdId, Phrase = phrase, CategoryId = request.CategoryId };
        db.CategoryPhraseRules.Add(rule);
        await db.SaveChangesAsync();
        return ServiceResult.Created(new { rule.Id, rule.Phrase, rule.CategoryId });
    }

    public async Task<ServiceResult> DeletePhraseRuleAsync(Guid householdId, Guid id)
    {
        var rule = await db.CategoryPhraseRules.SingleOrDefaultAsync(r => r.Id == id && r.HouseholdId == householdId);
        if (rule is null) return ServiceResult.NotFound();

        db.CategoryPhraseRules.Remove(rule);
        await db.SaveChangesAsync();
        return ServiceResult.NoContent();
    }
}
