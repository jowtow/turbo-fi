using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TurboFi.Api.Models;
using TurboFi.Api.Services;

namespace TurboFi.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/household")]
public sealed class HouseholdsController(HouseholdService householdService) : ControllerBase
{
    [HttpPost("invitations")]
    public async Task<ActionResult> Invite(InvitationRequest request) =>
        (await householdService.InviteAsync(User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)!.Value, request))
            .ToActionResult(this);

    [AllowAnonymous]
    [HttpPost("invitations/{token}/accept")]
    public async Task<ActionResult> Accept(string token, AcceptInvitationRequest request)
    {
        var result = await householdService.AcceptInvitationAsync(token, request);
        if (!result.IsSuccess && result.Status == 400 && result.Data is not null)
            return ValidationProblem(new Microsoft.AspNetCore.Mvc.ValidationProblemDetails(
                (Dictionary<string, string[]>)result.Data));
        return result.ToActionResult(this);
    }
}
