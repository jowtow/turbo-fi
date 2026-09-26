using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using TurboFi.Api.Domain;
using TurboFi.Api.Infrastructure;
using TurboFi.Api.Models;

namespace TurboFi.Api.Services;

public sealed class HouseholdService(UserManager<ApplicationUser> userManager, TurboFiDbContext db)
{
    public async Task<ServiceResult> InviteAsync(string userId, InvitationRequest request)
    {
        var user = await userManager.FindByIdAsync(userId);
        if (user is null) return ServiceResult.NotFound();

        var household = await db.Households.FindAsync(user.HouseholdId);
        if (household?.OwnerUserId != userId) return ServiceResult.Forbidden();

        var invitation = new HouseholdInvitation
        {
            HouseholdId = user.HouseholdId,
            Email = request.Email.Trim(),
            Token = Convert.ToHexString(Guid.NewGuid().ToByteArray()),
            ExpiresAt = DateTimeOffset.UtcNow.AddDays(7)
        };
        db.HouseholdInvitations.Add(invitation);
        await db.SaveChangesAsync();
        return ServiceResult.Created(new { invitation.Email, invitation.Token, invitation.ExpiresAt });
    }

    public async Task<ServiceResult> AcceptInvitationAsync(string token, AcceptInvitationRequest request)
    {
        var invitation = await db.HouseholdInvitations.SingleOrDefaultAsync(item => item.Token == token);
        if (invitation is null || invitation.AcceptedAt is not null || invitation.ExpiresAt <= DateTimeOffset.UtcNow)
            return ServiceResult.BadRequest("This invitation is invalid or expired.");
        if (!string.Equals(invitation.Email, request.Email, StringComparison.OrdinalIgnoreCase))
            return ServiceResult.BadRequest("Use the invited email address.");

        var newUser = new ApplicationUser
        {
            UserName = request.Email,
            Email = request.Email,
            HouseholdId = invitation.HouseholdId
        };
        var result = await userManager.CreateAsync(newUser, request.Password);
        if (!result.Succeeded)
            return new ServiceResult
            {
                Status = 400,
                Data = result.Errors.ToDictionary(error => error.Code, error => new[] { error.Description })
            };

        invitation.AcceptedAt = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync();
        return ServiceResult.NoContent();
    }
}
