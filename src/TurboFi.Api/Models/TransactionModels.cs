namespace TurboFi.Api.Models;

public sealed record CategorizeTransactionRequest(Guid CategoryId);
public sealed record MarkTransferRequest(Guid? DestinationAccountId, string? DestinationName);
