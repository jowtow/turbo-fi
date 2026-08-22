using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using TurboFi.Api.Domain;

namespace TurboFi.Api.Infrastructure;

public sealed class TurboFiDbContext(DbContextOptions<TurboFiDbContext> options)
    : IdentityDbContext<ApplicationUser>(options)
{
    public DbSet<Household> Households => Set<Household>();
    public DbSet<HouseholdInvitation> HouseholdInvitations => Set<HouseholdInvitation>();
    public DbSet<FinancialAccount> FinancialAccounts => Set<FinancialAccount>();
    public DbSet<ExpenseType> ExpenseTypes => Set<ExpenseType>();
    public DbSet<Category> Categories => Set<Category>();
    public DbSet<PlannedEntry> PlannedEntries => Set<PlannedEntry>();
    public DbSet<FinancialTransaction> FinancialTransactions => Set<FinancialTransaction>();

    protected override void OnModelCreating(ModelBuilder builder)
    {
        base.OnModelCreating(builder);
        builder.Entity<ApplicationUser>().HasOne(user => user.Household)
            .WithMany(household => household.Members).HasForeignKey(user => user.HouseholdId)
            .OnDelete(DeleteBehavior.Restrict);
        builder.Entity<HouseholdInvitation>().HasIndex(invitation => invitation.Token).IsUnique();
        builder.Entity<ExpenseType>().HasIndex(type => new { type.HouseholdId, type.Name }).IsUnique();
        builder.Entity<Category>().HasOne<ExpenseType>().WithMany().HasForeignKey(category => category.ExpenseTypeId)
            .OnDelete(DeleteBehavior.Restrict);
        builder.Entity<Category>().HasIndex(category => new { category.HouseholdId, category.Name }).IsUnique();
        builder.Entity<FinancialTransaction>().HasIndex(transaction => new
        {
            transaction.HouseholdId, transaction.FinancialAccountId, transaction.ImportFingerprint
        }).IsUnique();
        builder.Entity<FinancialTransaction>().Property(transaction => transaction.Amount).HasPrecision(18, 2);
        builder.Entity<FinancialTransaction>().Property(transaction => transaction.TransferDestinationName).HasMaxLength(200);
        builder.Entity<PlannedEntry>().Property(entry => entry.Amount).HasPrecision(18, 2);
        builder.Entity<PlannedEntry>().HasIndex(entry => new { entry.HouseholdId, entry.CategoryId, entry.PlanMonth }).IsUnique();
        builder.Entity<PlannedEntry>().Property(entry => entry.IsFixed).HasDefaultValue(false);
    }
}
