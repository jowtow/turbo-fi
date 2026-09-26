namespace TurboFi.Api.Models;

public sealed record CategoryRequest(string Name, Guid ExpenseTypeId, string? Color = null, bool IsArchived = false);
