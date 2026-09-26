namespace TurboFi.Api.Models;

public sealed record ImportSchemeRequest(
    string Name,
    string DateColumn,
    string DescriptionColumn,
    string AmountColumn,
    string? CheckNumberColumn,
    string? StatusColumn,
    string DateFormat = "M/d/yyyy",
    bool InvertAmount = false,
    int SkipHeaderRows = 0,
    string[]? RequiredHeaders = null);

public sealed record ImportSchemeResponse(
    Guid Id,
    string Name,
    bool IsGlobal,
    string DateColumn,
    string DescriptionColumn,
    string AmountColumn,
    string? CheckNumberColumn,
    string? StatusColumn,
    string DateFormat,
    bool InvertAmount,
    int SkipHeaderRows,
    string[]? RequiredHeaders);

public sealed record ImportRequest(Guid AccountId, Guid SchemeId, string? DescriptionOverridesJson);
