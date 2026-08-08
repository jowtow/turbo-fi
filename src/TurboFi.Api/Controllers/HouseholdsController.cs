using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TurboFi.Api.Domain;
using TurboFi.Api.Infrastructure;

namespace TurboFi.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/household")]
public sealed class HouseholdsController(
    UserManager<ApplicationUser> userManager,
    TurboFiDbContext db) : ControllerBase
{
    [HttpPost("invitations")]
    public async Task<ActionResult> Invite(InvitationRequest request)
    {
        var user = await userManager.GetUserAsync(User);
        var household = await db.Households.FindAsync(user!.HouseholdId);
        if (household?.OwnerUserId != user.Id) return Forbid();

        var invitation = new HouseholdInvitation
        {
            HouseholdId = user.HouseholdId, Email = request.Email.Trim(), Token = Convert.ToHexString(Guid.NewGuid().ToByteArray()),
            ExpiresAt = DateTimeOffset.UtcNow.AddDays(7)
        };
        db.HouseholdInvitations.Add(invitation);
        await db.SaveChangesAsync();
        return Created("", new { invitation.Email, invitation.Token, invitation.ExpiresAt });
    }

    [AllowAnonymous]
    [HttpPost("invitations/{token}/accept")]
    public async Task<ActionResult> Accept(string token, AcceptInvitationRequest request)
    {
        var invitation = await db.HouseholdInvitations.SingleOrDefaultAsync(item => item.Token == token);
        if (invitation is null || invitation.AcceptedAt is not null || invitation.ExpiresAt <= DateTimeOffset.UtcNow) return BadRequest("This invitation is invalid or expired.");
        if (!string.Equals(invitation.Email, request.Email, StringComparison.OrdinalIgnoreCase)) return BadRequest("Use the invited email address.");

        var user = new ApplicationUser { UserName = request.Email, Email = request.Email, HouseholdId = invitation.HouseholdId };
        var result = await userManager.CreateAsync(user, request.Password);
        if (!result.Succeeded) return ValidationProblem(new ValidationProblemDetails(result.Errors.ToDictionary(error => error.Code, error => new[] { error.Description })));
        invitation.AcceptedAt = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync();
        return NoContent();
    }
}

public sealed record InvitationRequest(string Email);
public sealed record AcceptInvitationRequest(string Email, string Password);
