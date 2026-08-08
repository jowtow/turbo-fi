using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using TurboFi.Api.Domain;
using TurboFi.Api.Infrastructure;

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
builder.Services.AddCors(options => options.AddDefaultPolicy(policy => policy
    .WithOrigins("http://localhost:5173")
    .AllowAnyHeader()
    .AllowAnyMethod()
    .AllowCredentials()));

var app = builder.Build();
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
}

app.Run();
