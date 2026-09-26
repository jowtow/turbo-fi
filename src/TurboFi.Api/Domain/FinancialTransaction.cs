namespace TurboFi.Api.Domain;

public sealed class FinancialTransaction
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid HouseholdId { get; set; }
    public Guid FinancialAccountId { get; set; }
    public Guid? CategoryId { get; set; }
    public required DateOnly TransactionDate { get; set; }
    public required string Description { get; set; }
    public decimal Amount { get; set; }
    public string? CheckNumber { get; set; }
    public string? Status { get; set; }
    public bool IsTransfer { get; set; }
    public Guid? TransferDestinationAccountId { get; set; }
    public string? TransferDestinationName { get; set; }
    public required string ImportFingerprint { get; set; }
    public DateTimeOffset ImportedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset? ReviewedAt { get; set; }
}
