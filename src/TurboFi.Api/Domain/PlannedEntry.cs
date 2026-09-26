namespace TurboFi.Api.Domain;

public sealed class PlannedEntry
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid HouseholdId { get; set; }
    public Guid FinancialAccountId { get; set; }
    public Guid CategoryId { get; set; }
    public required string Name { get; set; }
    public decimal Amount { get; set; }
    public DateOnly PlanMonth { get; set; }
    public bool IsFixed { get; set; }
    public bool IsActive { get; set; } = true;
}
