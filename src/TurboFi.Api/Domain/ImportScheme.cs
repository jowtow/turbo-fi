namespace TurboFi.Api.Domain;

/// <summary>
/// Describes how to parse a CSV file from a particular bank or financial institution.
/// Global (IsGlobal=true) schemes are predefined and read-only for users.
/// Household-scoped schemes are created and owned by a household.
/// </summary>
public sealed class ImportScheme
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public required string Name { get; set; }
    public bool IsGlobal { get; set; }
    public Guid? HouseholdId { get; set; }

    // Required column name mappings (as they appear in the CSV header row)
    public required string DateColumn { get; set; }
    public required string DescriptionColumn { get; set; }
    public required string AmountColumn { get; set; }

    // Optional column name mappings
    public string? CheckNumberColumn { get; set; }
    public string? StatusColumn { get; set; }

    // Parsing behavior
    public string DateFormat { get; set; } = "M/d/yyyy";
    /// <summary>Some banks export debits as positive values; set true to negate the parsed amount.</summary>
    public bool InvertAmount { get; set; }
    /// <summary>Number of rows to skip before the header row (e.g. bank-added metadata rows).</summary>
    public int SkipHeaderRows { get; set; }
    /// <summary>JSON-serialized string[] of column names that must be present in the CSV header.</summary>
    public string? RequiredHeadersJson { get; set; }
}
