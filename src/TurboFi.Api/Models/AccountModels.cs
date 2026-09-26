namespace TurboFi.Api.Models;

public sealed record AccountRequest(string Name, string? Institution, string? LastFour);
