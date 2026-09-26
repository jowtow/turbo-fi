namespace TurboFi.Api.Models;

public sealed record InvitationRequest(string Email);
public sealed record AcceptInvitationRequest(string Email, string Password);
