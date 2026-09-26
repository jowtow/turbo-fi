using Microsoft.AspNetCore.Identity;

namespace TurboFi.Api.Domain;

public sealed class ApplicationUser : IdentityUser
{
    public Guid HouseholdId { get; set; }
    public Household? Household { get; set; }
}
