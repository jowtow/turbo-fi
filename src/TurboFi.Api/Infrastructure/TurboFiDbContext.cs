using System.Text.Json;
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
    public DbSet<CategoryPhraseRule> CategoryPhraseRules => Set<CategoryPhraseRule>();
    public DbSet<ImportScheme> ImportSchemes => Set<ImportScheme>();

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
        builder.Entity<CategoryPhraseRule>().Property(rule => rule.Phrase).HasMaxLength(200);
        builder.Entity<CategoryPhraseRule>().HasIndex(rule => new { rule.HouseholdId, rule.Phrase }).IsUnique();
        builder.Entity<CategoryPhraseRule>().HasOne<Category>().WithMany().HasForeignKey(rule => rule.CategoryId)
            .OnDelete(DeleteBehavior.Restrict);
        builder.Entity<PlannedEntry>().Property(entry => entry.Amount).HasPrecision(18, 2);
        builder.Entity<PlannedEntry>().HasIndex(entry => new { entry.HouseholdId, entry.CategoryId, entry.PlanMonth }).IsUnique();
        builder.Entity<PlannedEntry>().Property(entry => entry.IsFixed).HasDefaultValue(false);

        // ImportScheme: household-scoped schemes have a unique name per household;
        // global schemes (HouseholdId IS NULL) are managed by seed data.
        builder.Entity<ImportScheme>()
            .HasIndex(s => new { s.HouseholdId, s.Name })
            .HasFilter("[HouseholdId] IS NOT NULL")
            .IsUnique();

        // Seed the built-in Wells Fargo import scheme (global, read-only for users)
        builder.Entity<ImportScheme>().HasData(new ImportScheme
        {
            Id = new Guid("a1b2c3d4-e5f6-7890-abcd-ef1234567890"),
            Name = "Wells Fargo",
            IsGlobal = true,
            HouseholdId = null,
            DateColumn = "DATE",
            DescriptionColumn = "DESCRIPTION",
            AmountColumn = "AMOUNT",
            CheckNumberColumn = "CHECK #",
            StatusColumn = "STATUS",
            DateFormat = "M/d/yyyy",
            InvertAmount = false,
            SkipHeaderRows = 0,
            RequiredHeadersJson = JsonSerializer.Serialize(new[] { "DATE", "DESCRIPTION", "AMOUNT", "CHECK #", "STATUS" })
        });
        builder.Entity<ImportScheme>().HasData(new ImportScheme
        {
            Id = new Guid("b2c3d4e5-f6a7-8901-bcde-f12345678901"),
            Name = "LEVO",
            IsGlobal = true,
            HouseholdId = null,
            DateColumn = "Date",
            DescriptionColumn = "Description",
            AmountColumn = "Amount",
            CheckNumberColumn = "Check #",
            StatusColumn = null,
            DateFormat = "M/d/yyyy",
            InvertAmount = false,
            SkipHeaderRows = 0,
            RequiredHeadersJson = JsonSerializer.Serialize(new[] { "Account", "Date", "Description", "Amount" })
        });
    }
}
