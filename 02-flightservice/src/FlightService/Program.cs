using FlightService;
using FlightService.Endpoints;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();
builder.Services.AddDbContext<FlightDbContext>(options =>
    options.UseSqlServer(builder.Configuration.GetConnectionString("FlightDb")));
builder.Services.AddScoped<FlightSearchService>();
builder.Services.AddHostedService<HoldSweepService>();

var keycloakIssuer = builder.Configuration["Keycloak:Issuer"]
    ?? "https://keycloak.voyagevibes.in:8091/realms/flight-booking";
var keycloakMetadataAddress = builder.Configuration["Keycloak:MetadataAddress"]
    ?? "https://keycloak:8091/realms/flight-booking/.well-known/openid-configuration";

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        // The realm's certificate is self-signed in this local/demo deployment.
        options.BackchannelHttpHandler = new HttpClientHandler
        {
            ServerCertificateCustomValidationCallback = (_, _, _, _) => true,
        };
        options.MetadataAddress = keycloakMetadataAddress;
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidIssuer = keycloakIssuer,
            ValidateAudience = false,
        };
    });
builder.Services.AddAuthorization();

var app = builder.Build();

app.UseAuthentication();
app.UseAuthorization();

app.UseSwagger();
app.UseSwaggerUI();

app.MapFlightEndpoints();

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<FlightDbContext>();
    await db.Database.EnsureCreatedAsync();

    // EnsureCreatedAsync only creates the schema for a brand-new database, so an existing
    // deployment (created before the holds table existed) needs this guarded backfill too.
    await db.Database.ExecuteSqlRawAsync("""
        IF OBJECT_ID(N'dbo.holds', N'U') IS NULL
        BEGIN
            CREATE TABLE dbo.holds (
                Id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
                FlightId UNIQUEIDENTIFIER NOT NULL,
                SeatsHeld INT NOT NULL,
                Status NVARCHAR(20) NOT NULL,
                CreatedAt DATETIMEOFFSET NOT NULL,
                ExpiresAt DATETIMEOFFSET NOT NULL
            );
            CREATE INDEX IX_holds_Status_ExpiresAt ON dbo.holds (Status, ExpiresAt);
        END
        """);

    await FlightSeeder.SeedAsync(db);
}

app.Run();
