using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TurboFi.Api.Domain;
using TurboFi.Api.Infrastructure;

namespace TurboFi.Api.Controllers;

[ApiController]
[Route("api/auth")]
public sealed class AuthController(
    UserManager<ApplicationUser> userManager,
    SignInManager<ApplicationUser> signInManager,
    TurboFiDbContext db) : ControllerBase
{
    [HttpPost("register")]
    public async Task<ActionResult> Register(RegisterRequest request)
    {
        if (await userManager.Users.AnyAsync())
            return Conflict("Public registration is only available for the first household owner.");

        var household = new Household { Name = request.HouseholdName.Trim() };
        var user = new ApplicationUser { UserName = request.Email, Email = request.Email, Household = household };
        var result = await userManager.CreateAsync(user, request.Password);
        if (!result.Succeeded) return ValidationProblem(result.Errors.ToDictionary(error => error.Code, error => new[] { error.Description }));

        household.OwnerUserId = user.Id;
        await db.SaveChangesAsync();
        await signInManager.SignInAsync(user, isPersistent: false);
        return Created("", new { user.Email, household.Name });
    }

    [HttpPost("login")]
    public async Task<ActionResult> Login(LoginRequest request)
    {
        var result = await signInManager.PasswordSignInAsync(request.Email, request.Password, false, lockoutOnFailure: true);
        return result.Succeeded ? NoContent() : Unauthorized("Invalid email or password.");
    }

    [Authorize]
    [HttpPost("logout")]
    public async Task<ActionResult> Logout()
    {
        await signInManager.SignOutAsync();
        return NoContent();
    }

    [Authorize]
    [HttpGet("me")]
    public async Task<ActionResult> Me()
    {
        var user = await userManager.GetUserAsync(User);
        if (user is null) return Unauthorized();
        var householdName = await db.Households.Where(household => household.Id == user.HouseholdId)
            .Select(household => household.Name).SingleAsync();
        return Ok(new { user.Email, user.HouseholdId, householdName });
    }
}

public sealed record RegisterRequest(string Email, string Password, string HouseholdName);
public sealed record LoginRequest(string Email, string Password);
