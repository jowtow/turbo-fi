using Microsoft.AspNetCore.Identity;

namespace TurboFi.Api.Domain;

public sealed class ApplicationUser : IdentityUser
{
    public Guid HouseholdId { get; set; }
    public Household? Household { get; set; }
}

public sealed class Household
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public required string Name { get; set; }
    public string? OwnerUserId { get; set; }
    public ICollection<ApplicationUser> Members { get; set; } = [];
}

public sealed class HouseholdInvitation
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid HouseholdId { get; set; }
    public required string Email { get; set; }
    public required string Token { get; set; }
    public DateTimeOffset ExpiresAt { get; set; }
    public DateTimeOffset? AcceptedAt { get; set; }
}

public sealed class FinancialAccount
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid HouseholdId { get; set; }
    public required string Name { get; set; }
    public string? Institution { get; set; }
    public string? LastFour { get; set; }
    public bool IsActive { get; set; } = true;
}

public sealed class Category
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid HouseholdId { get; set; }
    public required string Name { get; set; }
    public string? Color { get; set; }
    public bool IsArchived { get; set; }
}

public sealed class PlannedEntry
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid HouseholdId { get; set; }
    public Guid FinancialAccountId { get; set; }
    public Guid CategoryId { get; set; }
    public required string Name { get; set; }
    public decimal Amount { get; set; }
    public int DayOfMonth { get; set; } = 1;
    public bool IsActive { get; set; } = true;
}

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
    public required string ImportFingerprint { get; set; }
    public DateTimeOffset ImportedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset? ReviewedAt { get; set; }
}
