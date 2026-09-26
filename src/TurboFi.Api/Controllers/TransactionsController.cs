using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TurboFi.Api.Models;
using TurboFi.Api.Services;

namespace TurboFi.Api.Controllers;

[ApiController]
[Authorize]
[Route("api")]
public sealed class TransactionsController(TransactionService transactionService, ImportService importService) : ControllerBase
{
    private Guid HouseholdId => Guid.Parse(User.FindFirst("householdId")!.Value);

    [HttpPost("imports")]
    [RequestSizeLimit(10_000_000)]
    public async Task<ActionResult> Import(
        [FromForm] IFormFile file,
        [FromForm] Guid accountId,
        [FromForm] Guid schemeId,
        [FromForm] string? descriptionOverrides)
    {
        Dictionary<int, string>? overrides;
        try
        {
            overrides = string.IsNullOrWhiteSpace(descriptionOverrides)
                ? null
                : JsonSerializer.Deserialize<Dictionary<int, string>>(descriptionOverrides);
        }
        catch (JsonException)
        {
            return BadRequest("Transaction description changes could not be read.");
        }

        var result = await importService.ImportCsvAsync(HouseholdId, accountId, schemeId, file, overrides);
        return result.ToActionResult(this);
    }

    [HttpGet("transactions/review")]
    public async Task<ActionResult> ReviewQueue() =>
        (await transactionService.GetReviewQueueAsync(HouseholdId)).ToActionResult(this);

    [HttpGet("transactions")]
    public async Task<ActionResult> Transactions(
        [FromQuery] int? year,
        [FromQuery] int? month,
        [FromQuery] Guid? accountId,
        [FromQuery] Guid? categoryId,
        [FromQuery] bool uncategorized = false) =>
        (await transactionService.GetTransactionsAsync(
            HouseholdId, year, month, accountId, categoryId, uncategorized)).ToActionResult(this);

    [HttpGet("transactions/categories")]
    public async Task<ActionResult> CategorySpending(
        [FromQuery] int? year,
        [FromQuery] int? month,
        [FromQuery] Guid? accountId) =>
        (await transactionService.GetCategorySpendingAsync(HouseholdId, year, month, accountId))
            .ToActionResult(this);

    [HttpGet("transactions/transfers")]
    public async Task<ActionResult> Transfers() =>
        (await transactionService.GetTransfersAsync(HouseholdId)).ToActionResult(this);

    [HttpPut("transactions/{id:guid}/category")]
    public async Task<ActionResult> Categorize(Guid id, CategorizeTransactionRequest request) =>
        (await transactionService.CategorizeAsync(HouseholdId, id, request)).ToActionResult(this);

    [HttpPost("transactions/{id:guid}/transfer")]
    public async Task<ActionResult> MarkTransfer(Guid id, MarkTransferRequest request) =>
        (await transactionService.MarkTransferAsync(HouseholdId, id, request)).ToActionResult(this);

    [HttpDelete("transactions/{id:guid}/transfer")]
    public async Task<ActionResult> UnmarkTransfer(Guid id) =>
        (await transactionService.UnmarkTransferAsync(HouseholdId, id)).ToActionResult(this);
}
