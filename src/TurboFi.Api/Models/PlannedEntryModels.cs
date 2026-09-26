namespace TurboFi.Api.Models;

public sealed record PlannedEntryRequest(Guid CategoryId, decimal Amount, int Year, int Month, bool IsFixed = false);
public sealed record PlannedEntryUpdateRequest(decimal Amount, bool IsFixed);
public sealed record PlannedEntryResponse(Guid Id, Guid CategoryId, decimal Amount, bool IsFixed);
