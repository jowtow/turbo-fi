using Microsoft.AspNetCore.Mvc;

namespace TurboFi.Api.Services;

public sealed class ServiceResult
{
    public int Status { get; init; }
    public string? Error { get; init; }
    public object? Data { get; init; }
    public bool IsSuccess => Status is >= 200 and < 300;

    public static ServiceResult Ok(object? data = null) => new() { Status = 200, Data = data };
    public static ServiceResult Created(object? data = null) => new() { Status = 201, Data = data };
    public static ServiceResult NoContent() => new() { Status = 204 };
    public static ServiceResult NotFound(string? message = null) => new() { Status = 404, Error = message };
    public static ServiceResult BadRequest(string message) => new() { Status = 400, Error = message };
    public static ServiceResult Conflict(string message) => new() { Status = 409, Error = message };
    public static ServiceResult Conflict(object data) => new() { Status = 409, Data = data };
    public static ServiceResult Forbidden() => new() { Status = 403 };
}

public static class ServiceResultExtensions
{
    public static ActionResult ToActionResult(this ServiceResult result, ControllerBase controller) =>
        result.Status switch
        {
            200 => result.Data is null ? controller.Ok() : controller.Ok(result.Data),
            201 => controller.Created("", result.Data),
            204 => controller.NoContent(),
            400 => controller.BadRequest(result.Error),
            403 => controller.Forbid(),
            404 => result.Error is null ? controller.NotFound() : controller.NotFound(result.Error),
            409 => result.Data is null ? controller.Conflict(result.Error) : controller.Conflict(result.Data),
            _ => controller.StatusCode(result.Status, result.Error)
        };
}
