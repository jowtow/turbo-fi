namespace TurboFi.Api.Domain;

public sealed class Household
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public required string Name { get; set; }
    public string? OwnerUserId { get; set; }
    public ICollection<ApplicationUser> Members { get; set; } = [];
}
