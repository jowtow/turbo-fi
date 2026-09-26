namespace TurboFi.Api.Domain;

public sealed class CategoryPhraseRule
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid HouseholdId { get; set; }
    public required string Phrase { get; set; }
    public Guid CategoryId { get; set; }
}
