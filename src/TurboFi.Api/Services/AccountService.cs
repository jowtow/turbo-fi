using Microsoft.EntityFrameworkCore;
using TurboFi.Api.Domain;
using TurboFi.Api.Infrastructure;
using TurboFi.Api.Models;

namespace TurboFi.Api.Services;

public sealed class AccountService(TurboFiDbContext db)
{
    public Task<List<FinancialAccount>> GetAccountsAsync(Guid householdId) =>
        db.FinancialAccounts
            .Where(account => account.HouseholdId == householdId)
            .OrderBy(account => account.Name)
            .ToListAsync();

    public async Task<ServiceResult> CreateAccountAsync(Guid householdId, AccountRequest request)
    {
        var account = new FinancialAccount
        {
            HouseholdId = householdId,
            Name = request.Name.Trim(),
            Institution = request.Institution?.Trim(),
            LastFour = request.LastFour?.Trim()
        };
        db.FinancialAccounts.Add(account);
        await db.SaveChangesAsync();
        return ServiceResult.Created(account);
    }
}
