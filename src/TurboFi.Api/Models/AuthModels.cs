namespace TurboFi.Api.Models;

public sealed record RegisterRequest(string Email, string Password, string HouseholdName);
public sealed record LoginRequest(string Email, string Password);
