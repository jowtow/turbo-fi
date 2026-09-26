using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TurboFi.Api.Models;
using TurboFi.Api.Services;

namespace TurboFi.Api.Controllers;

[ApiController]
[Authorize]
[Route("api")]
public sealed class FinanceController(
    AccountService accountService,
    ExpenseTypeService expenseTypeService,
    CategoryService categoryService,
    PlannedEntryService plannedEntryService,
    DashboardService dashboardService,
    PhraseRuleService phraseRuleService) : ControllerBase
{
    private Guid HouseholdId => Guid.Parse(User.FindFirstValue("householdId")
        ?? throw new InvalidOperationException("The signed-in user has no household."));

    [HttpGet("accounts")]
    public async Task<ActionResult> Accounts() => Ok(await accountService.GetAccountsAsync(HouseholdId));

    [HttpPost("accounts")]
    public async Task<ActionResult> CreateAccount(AccountRequest request) =>
        (await accountService.CreateAccountAsync(HouseholdId, request)).ToActionResult(this);

    [HttpGet("expense-types")]
    public async Task<ActionResult> ExpenseTypes() => Ok(await expenseTypeService.GetExpenseTypesAsync(HouseholdId));

    [HttpPost("expense-types")]
    public async Task<ActionResult> CreateExpenseType(ExpenseTypeRequest request) =>
        (await expenseTypeService.CreateExpenseTypeAsync(HouseholdId, request)).ToActionResult(this);

    [HttpPut("expense-types/{id:guid}")]
    public async Task<ActionResult> UpdateExpenseType(Guid id, ExpenseTypeRequest request) =>
        (await expenseTypeService.UpdateExpenseTypeAsync(HouseholdId, id, request)).ToActionResult(this);

    [HttpDelete("expense-types/{id:guid}")]
    public async Task<ActionResult> DeleteExpenseType(Guid id) =>
        (await expenseTypeService.DeleteExpenseTypeAsync(HouseholdId, id)).ToActionResult(this);

    [HttpGet("categories")]
    public async Task<ActionResult> Categories() => Ok(await categoryService.GetCategoriesAsync(HouseholdId));

    [HttpPost("categories")]
    public async Task<ActionResult> CreateCategory(CategoryRequest request) =>
        (await categoryService.CreateCategoryAsync(HouseholdId, request)).ToActionResult(this);

    [HttpPut("categories/{id:guid}")]
    public async Task<ActionResult> UpdateCategory(Guid id, CategoryRequest request) =>
        (await categoryService.UpdateCategoryAsync(HouseholdId, id, request)).ToActionResult(this);

    [HttpDelete("categories/{id:guid}")]
    public async Task<ActionResult> DeleteCategory(Guid id) =>
        (await categoryService.DeleteCategoryAsync(HouseholdId, id)).ToActionResult(this);

    [HttpGet("planned-entries")]
    public async Task<ActionResult> PlannedEntries([FromQuery] int year, [FromQuery] int month) =>
        (await plannedEntryService.GetPlannedEntriesAsync(HouseholdId, year, month)).ToActionResult(this);

    [HttpPost("planned-entries")]
    public async Task<ActionResult> CreatePlannedEntry(PlannedEntryRequest request) =>
        (await plannedEntryService.CreatePlannedEntryAsync(HouseholdId, request)).ToActionResult(this);

    [HttpPut("planned-entries/{id:guid}")]
    public async Task<ActionResult> UpdatePlannedEntry(Guid id, PlannedEntryUpdateRequest request) =>
        (await plannedEntryService.UpdatePlannedEntryAsync(HouseholdId, id, request)).ToActionResult(this);

    [HttpDelete("planned-entries/{id:guid}")]
    public async Task<ActionResult> DeletePlannedEntry(Guid id) =>
        (await plannedEntryService.DeletePlannedEntryAsync(HouseholdId, id)).ToActionResult(this);

    [HttpGet("dashboard")]
    public async Task<ActionResult> Dashboard([FromQuery] int? year, [FromQuery] int? month) =>
        (await dashboardService.GetDashboardAsync(HouseholdId, year, month)).ToActionResult(this);

    [HttpGet("dashboard/burndown")]
    public async Task<ActionResult> Burndown(
        [FromQuery] int? year, [FromQuery] int? month,
        [FromQuery] Guid? expenseTypeId, [FromQuery] Guid? categoryId) =>
        (await dashboardService.GetBurndownAsync(HouseholdId, year, month, expenseTypeId, categoryId)).ToActionResult(this);

    [HttpGet("phrase-rules")]
    public async Task<ActionResult> PhraseRules() =>
        (await phraseRuleService.GetPhraseRulesAsync(HouseholdId)).ToActionResult(this);

    [HttpPost("phrase-rules")]
    public async Task<ActionResult> CreatePhraseRule(PhraseRuleRequest request) =>
        (await phraseRuleService.CreatePhraseRuleAsync(HouseholdId, request)).ToActionResult(this);

    [HttpDelete("phrase-rules/{id:guid}")]
    public async Task<ActionResult> DeletePhraseRule(Guid id) =>
        (await phraseRuleService.DeletePhraseRuleAsync(HouseholdId, id)).ToActionResult(this);
}
