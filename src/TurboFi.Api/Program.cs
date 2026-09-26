using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using QuestPDF.Infrastructure;
using TurboFi.Api.Domain;
using TurboFi.Api.Infrastructure;
using TurboFi.Api.Services;

var builder = WebApplication.CreateBuilder(args);
builder.Services.AddDbContext<TurboFiDbContext>(options =>
    options.UseSqlServer(builder.Configuration.GetConnectionString("TurboFi")));
builder.Services.AddIdentity<ApplicationUser, IdentityRole>(options =>
{
    options.User.RequireUniqueEmail = true;
    options.Password.RequiredLength = 10;
    options.SignIn.RequireConfirmedAccount = false;
})
    .AddEntityFrameworkStores<TurboFiDbContext>()
    .AddDefaultTokenProviders();
builder.Services.AddScoped<IUserClaimsPrincipalFactory<ApplicationUser>, ApplicationClaimsPrincipalFactory>();
builder.Services.ConfigureApplicationCookie(options =>
{
    options.Cookie.Name = "turbo-fi";
    options.Cookie.SameSite = SameSiteMode.Lax;
    options.Events.OnRedirectToLogin = context =>
    {
        context.Response.StatusCode = StatusCodes.Status401Unauthorized;
        return Task.CompletedTask;
    };
});
builder.Services.AddAuthorization();
builder.Services.AddControllers();

// Domain services
builder.Services.AddScoped<AccountService>();
builder.Services.AddScoped<ExpenseTypeService>();
builder.Services.AddScoped<CategoryService>();
builder.Services.AddScoped<PlannedEntryService>();
builder.Services.AddScoped<DashboardService>();
builder.Services.AddScoped<MonthlyReportService>();
builder.Services.AddScoped<PhraseRuleService>();
builder.Services.AddScoped<TransactionService>();
builder.Services.AddScoped<ImportService>();
builder.Services.AddScoped<HouseholdService>();
var corsOrigins = builder.Configuration["CorsOrigins"]?.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
    ?? ["http://localhost:5173"];
builder.Services.AddCors(options => options.AddDefaultPolicy(policy => policy
    .WithOrigins(corsOrigins)
    .AllowAnyHeader()
    .AllowAnyMethod()
    .AllowCredentials()));

var app = builder.Build();
QuestPDF.Settings.License = LicenseType.Community;
app.UseCors();
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();
app.MapGet("/health", () => Results.Ok(new { status = "healthy" }));

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<TurboFiDbContext>();
    await db.Database.EnsureCreatedAsync();
    await db.Database.ExecuteSqlRawAsync("""
        IF OBJECT_ID('dbo.ExpenseTypes', 'U') IS NULL
        BEGIN
            CREATE TABLE dbo.ExpenseTypes (
                Id uniqueidentifier NOT NULL PRIMARY KEY,
                HouseholdId uniqueidentifier NOT NULL,
                Name nvarchar(450) NOT NULL
            );
        END
        IF NOT EXISTS (
            SELECT 1 FROM sys.indexes
            WHERE name = 'IX_ExpenseTypes_HouseholdId_Name'
                AND object_id = OBJECT_ID('dbo.ExpenseTypes')
        )
        BEGIN
            CREATE UNIQUE INDEX IX_ExpenseTypes_HouseholdId_Name
                ON dbo.ExpenseTypes (HouseholdId, Name);
        END
        IF COL_LENGTH('dbo.Categories', 'ExpenseTypeId') IS NULL
        BEGIN
            ALTER TABLE dbo.Categories ADD ExpenseTypeId uniqueidentifier NULL;
        END
        """);

    var householdIds = await db.Households.Select(household => household.Id).ToListAsync();
    var existingTypes = await db.ExpenseTypes
        .Where(type => householdIds.Contains(type.HouseholdId))
        .Select(type => new { type.HouseholdId, type.Name })
        .ToListAsync();
    db.ExpenseTypes.AddRange(
        from householdId in householdIds
        from name in ExpenseTypeDefaults.Names
        where !existingTypes.Any(type => type.HouseholdId == householdId && type.Name == name)
        select new ExpenseType { HouseholdId = householdId, Name = name });
    await db.SaveChangesAsync();

    var uncategorizedTypes = await db.ExpenseTypes
        .Where(type => householdIds.Contains(type.HouseholdId) && type.Name == ExpenseTypeDefaults.Uncategorized)
        .ToDictionaryAsync(type => type.HouseholdId, type => type.Id);
    foreach (var (householdId, typeId) in uncategorizedTypes)
        await db.Database.ExecuteSqlInterpolatedAsync(
            $"UPDATE dbo.Categories SET ExpenseTypeId = {typeId} WHERE HouseholdId = {householdId} AND ExpenseTypeId IS NULL;");

    await db.Database.ExecuteSqlRawAsync("""
        ALTER TABLE dbo.Categories ALTER COLUMN ExpenseTypeId uniqueidentifier NOT NULL;
        IF NOT EXISTS (
            SELECT 1 FROM sys.foreign_keys
            WHERE name = 'FK_Categories_ExpenseTypes_ExpenseTypeId'
        )
        BEGIN
            ALTER TABLE dbo.Categories ADD CONSTRAINT FK_Categories_ExpenseTypes_ExpenseTypeId
                FOREIGN KEY (ExpenseTypeId) REFERENCES dbo.ExpenseTypes (Id);
        END
        IF COL_LENGTH('dbo.PlannedEntries', 'DayOfMonth') IS NOT NULL
        BEGIN
            DECLARE @dayDefaultConstraint nvarchar(128);
            SELECT @dayDefaultConstraint = dc.name
            FROM sys.default_constraints dc
            INNER JOIN sys.columns c ON c.default_object_id = dc.object_id
            WHERE dc.parent_object_id = OBJECT_ID('dbo.PlannedEntries') AND c.name = 'DayOfMonth';
            IF @dayDefaultConstraint IS NOT NULL
                EXEC('ALTER TABLE dbo.PlannedEntries DROP CONSTRAINT [' + @dayDefaultConstraint + ']');
            ALTER TABLE dbo.PlannedEntries DROP COLUMN DayOfMonth;
        END
        """);
    await db.Database.ExecuteSqlRawAsync("""
        IF COL_LENGTH('dbo.PlannedEntries', 'PlanMonth') IS NULL
        BEGIN
            ALTER TABLE dbo.PlannedEntries ADD PlanMonth date NULL;
            UPDATE dbo.PlannedEntries
                SET PlanMonth = DATEFROMPARTS(YEAR(GETUTCDATE()), MONTH(GETUTCDATE()), 1)
                WHERE PlanMonth IS NULL;
            ALTER TABLE dbo.PlannedEntries ALTER COLUMN PlanMonth date NOT NULL;
        END
        IF NOT EXISTS (
            SELECT 1 FROM sys.indexes
            WHERE name = 'IX_PlannedEntries_HouseholdId_CategoryId_PlanMonth'
                AND object_id = OBJECT_ID('dbo.PlannedEntries')
        )
        BEGIN
            CREATE UNIQUE INDEX IX_PlannedEntries_HouseholdId_CategoryId_PlanMonth
                ON dbo.PlannedEntries (HouseholdId, CategoryId, PlanMonth);
        END
        """);
    await db.Database.ExecuteSqlRawAsync("""
        IF COL_LENGTH('dbo.PlannedEntries', 'IsFixed') IS NULL
        BEGIN
            ALTER TABLE dbo.PlannedEntries ADD IsFixed bit NOT NULL
                CONSTRAINT DF_PlannedEntries_IsFixed DEFAULT 0;
        END
        """);
    await db.Database.ExecuteSqlRawAsync("""
        IF COL_LENGTH('dbo.FinancialTransactions', 'IsTransfer') IS NULL
        BEGIN
            ALTER TABLE dbo.FinancialTransactions ADD IsTransfer bit NOT NULL
                CONSTRAINT DF_FinancialTransactions_IsTransfer DEFAULT 0;
        END
        IF COL_LENGTH('dbo.FinancialTransactions', 'TransferDestinationAccountId') IS NULL
        BEGIN
            ALTER TABLE dbo.FinancialTransactions ADD TransferDestinationAccountId uniqueidentifier NULL;
        END
        IF COL_LENGTH('dbo.FinancialTransactions', 'TransferDestinationName') IS NULL
        BEGIN
            ALTER TABLE dbo.FinancialTransactions ADD TransferDestinationName nvarchar(200) NULL;
        END
        """);
    await db.Database.ExecuteSqlRawAsync("""
        IF OBJECT_ID('dbo.CategoryPhraseRules', 'U') IS NULL
        BEGIN
            CREATE TABLE dbo.CategoryPhraseRules (
                Id uniqueidentifier NOT NULL PRIMARY KEY,
                HouseholdId uniqueidentifier NOT NULL,
                Phrase nvarchar(200) NOT NULL,
                CategoryId uniqueidentifier NOT NULL,
                CONSTRAINT FK_CategoryPhraseRules_Categories_CategoryId
                    FOREIGN KEY (CategoryId) REFERENCES dbo.Categories (Id)
            );
            CREATE UNIQUE INDEX IX_CategoryPhraseRules_HouseholdId_Phrase
                ON dbo.CategoryPhraseRules (HouseholdId, Phrase);
        END
        """);
    await db.Database.ExecuteSqlRawAsync("""
        IF OBJECT_ID('dbo.ImportSchemes', 'U') IS NULL
        BEGIN
            CREATE TABLE dbo.ImportSchemes (
                Id uniqueidentifier NOT NULL PRIMARY KEY,
                Name nvarchar(450) NOT NULL,
                IsGlobal bit NOT NULL,
                HouseholdId uniqueidentifier NULL,
                DateColumn nvarchar(max) NOT NULL,
                DescriptionColumn nvarchar(max) NOT NULL,
                AmountColumn nvarchar(max) NOT NULL,
                CheckNumberColumn nvarchar(max) NULL,
                StatusColumn nvarchar(max) NULL,
                DateFormat nvarchar(max) NOT NULL,
                InvertAmount bit NOT NULL,
                SkipHeaderRows int NOT NULL,
                RequiredHeadersJson nvarchar(max) NULL
            );
            CREATE UNIQUE INDEX IX_ImportSchemes_HouseholdId_Name
                ON dbo.ImportSchemes (HouseholdId, Name)
                WHERE HouseholdId IS NOT NULL;
        END
        IF NOT EXISTS (SELECT 1 FROM dbo.ImportSchemes WHERE Id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890')
        BEGIN
            INSERT INTO dbo.ImportSchemes (
                Id, Name, IsGlobal, HouseholdId, DateColumn, DescriptionColumn, AmountColumn,
                CheckNumberColumn, StatusColumn, DateFormat, InvertAmount, SkipHeaderRows, RequiredHeadersJson
            ) VALUES (
                'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Wells Fargo', 1, NULL, 'DATE', 'DESCRIPTION',
                'AMOUNT', 'CHECK #', 'STATUS', 'M/d/yyyy', 0, 0, '["DATE","DESCRIPTION","AMOUNT","CHECK #","STATUS"]'
            );
        END
        IF NOT EXISTS (SELECT 1 FROM dbo.ImportSchemes WHERE Id = 'b2c3d4e5-f6a7-8901-bcde-f12345678901')
        BEGIN
            INSERT INTO dbo.ImportSchemes (
                Id, Name, IsGlobal, HouseholdId, DateColumn, DescriptionColumn, AmountColumn,
                CheckNumberColumn, StatusColumn, DateFormat, InvertAmount, SkipHeaderRows, RequiredHeadersJson
            ) VALUES (
                'b2c3d4e5-f6a7-8901-bcde-f12345678901', 'Wells Fargo Transaction History', 1, NULL, 'Date',
                'Description', 'Amount', 'Check #', NULL, 'M/d/yyyy', 0, 0, '["Account","Date","Description","Amount"]'
            );
        END
        """);
}

app.Run();
