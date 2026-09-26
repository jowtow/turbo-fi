using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TurboFi.Api.Models;
using TurboFi.Api.Services;

namespace TurboFi.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/import-schemes")]
public sealed class ImportSchemesController(ImportService importService) : ControllerBase
{
    private Guid HouseholdId => Guid.Parse(User.FindFirst("householdId")!.Value);

    [HttpGet]
    public async Task<ActionResult> GetSchemes() =>
        Ok(await importService.GetSchemesAsync(HouseholdId));

    [HttpPost]
    public async Task<ActionResult> CreateScheme(ImportSchemeRequest request) =>
        (await importService.CreateSchemeAsync(HouseholdId, request)).ToActionResult(this);

    [HttpPut("{id:guid}")]
    public async Task<ActionResult> UpdateScheme(Guid id, ImportSchemeRequest request) =>
        (await importService.UpdateSchemeAsync(HouseholdId, id, request)).ToActionResult(this);

    [HttpDelete("{id:guid}")]
    public async Task<ActionResult> DeleteScheme(Guid id) =>
        (await importService.DeleteSchemeAsync(HouseholdId, id)).ToActionResult(this);
}
