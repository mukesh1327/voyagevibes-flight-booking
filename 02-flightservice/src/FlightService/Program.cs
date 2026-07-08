using FlightService;
using FlightService.Endpoints;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();
builder.Services.AddDbContext<FlightDbContext>(options =>
    options.UseSqlServer(builder.Configuration.GetConnectionString("FlightDb")));
builder.Services.AddScoped<FlightSearchService>();

var app = builder.Build();

app.UseSwagger();
app.UseSwaggerUI();

app.MapFlightEndpoints();

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<FlightDbContext>();
    await db.Database.EnsureCreatedAsync();
    await FlightSeeder.SeedAsync(db);
}

app.Run();
