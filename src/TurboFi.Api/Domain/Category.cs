namespace TurboFi.Api.Domain;

public sealed class Category
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid HouseholdId { get; set; }
    public Guid ExpenseTypeId { get; set; }
    public required string Name { get; set; }
    public string? Color { get; set; }
    public bool IsArchived { get; set; }
}
