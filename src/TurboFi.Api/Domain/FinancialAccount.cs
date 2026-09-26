namespace TurboFi.Api.Domain;

public sealed class FinancialAccount
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid HouseholdId { get; set; }
    public required string Name { get; set; }
    public string? Institution { get; set; }
    public string? LastFour { get; set; }
    public bool IsActive { get; set; } = true;
}
