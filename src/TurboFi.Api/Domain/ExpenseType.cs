namespace TurboFi.Api.Domain;

public sealed class ExpenseType
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid HouseholdId { get; set; }
    public required string Name { get; set; }
}

public static class ExpenseTypeDefaults
{
    public const string Uncategorized = "Uncategorized";

    public static readonly string[] Names =
    [
        "Mortgage",
        "Groceries",
        "Restaurants",
        "Utilities",
        "Entertainment",
        "Insurance",
        "Phone",
        Uncategorized
    ];
}
