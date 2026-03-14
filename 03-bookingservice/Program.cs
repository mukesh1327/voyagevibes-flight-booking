using System.Security.Cryptography.X509Certificates;
using bookingservice.Api;
using bookingservice.Application;
using bookingservice.Domain;
using bookingservice.Infrastructure;
using bookingservice.Messaging;
using Microsoft.Extensions.Options;

var builder = WebApplication.CreateBuilder(args);

var activeEnv = (Environment.GetEnvironmentVariable("APP_ENV") ?? "dev").Trim().ToLowerInvariant();
if (activeEnv is not ("dev" or "prod"))
{
    activeEnv = "dev";
}

builder.Configuration.AddJsonFile($"appsettings.{activeEnv}.json", optional: true, reloadOnChange: true);

builder.Services.Configure<BookingServiceOptions>(builder.Configuration.GetSection("BookingService"));
builder.Services.Configure<FlightServiceOptions>(builder.Configuration.GetSection("ExternalServices:Flight"));
builder.Services.Configure<KafkaOptions>(builder.Configuration.GetSection("Kafka"));

var bookingDbConnectionString = builder.Configuration.GetConnectionString("BookingDb");
if (string.IsNullOrWhiteSpace(bookingDbConnectionString))
{
    throw new InvalidOperationException("BookingDb connection string is required. Set ConnectionStrings:BookingDb or ConnectionStrings__BookingDb.");
}

builder.Services.AddSingleton<BookingKafkaMetrics>();
builder.Services.AddSingleton<IBookingRepository>(_ => new SqlBookingRepository(bookingDbConnectionString));
builder.Services.AddSingleton<IIdempotencyStore>(_ => new SqlIdempotencyStore(bookingDbConnectionString));
builder.Services.AddSingleton<IBookingEventPublisher, KafkaBookingEventPublisher>();
builder.Services.AddSingleton<BookingApplicationService>();
builder.Services.AddHostedService<BookingOutboxPublisherService>();

builder.Services
    .AddHttpClient<IFlightInventoryGateway, FlightInventoryGateway>((serviceProvider, client) =>
    {
        var options = serviceProvider.GetRequiredService<IOptions<FlightServiceOptions>>().Value;
        client.BaseAddress = new Uri(options.BaseUrl.TrimEnd('/'));
        client.Timeout = TimeSpan.FromSeconds(Math.Max(options.TimeoutSeconds, 1));
    })
    .ConfigurePrimaryHttpMessageHandler(serviceProvider =>
    {
        var options = serviceProvider.GetRequiredService<IOptions<FlightServiceOptions>>().Value;
        var handler = new HttpClientHandler();
        if (options.AllowInsecureTls)
        {
            handler.ServerCertificateCustomValidationCallback = HttpClientHandler.DangerousAcceptAnyServerCertificateValidator;
        }

        return handler;
    });

builder.Services.AddHostedService<KafkaEventConsumerService>();

var httpPort = ParsePort(Environment.GetEnvironmentVariable("HTTP_PORT") ?? Environment.GetEnvironmentVariable("PORT"), 8083);
var httpsPort = ParsePort(Environment.GetEnvironmentVariable("HTTPS_PORT"), 9093);
var sslEnabled = bool.TryParse(Environment.GetEnvironmentVariable("SERVER_SSL_ENABLED"), out var sslFlag) && sslFlag;
builder.WebHost.ConfigureKestrel(options =>
{
    options.ListenAnyIP(httpPort);

    if (!sslEnabled)
    {
        return;
    }

    var certPath = Environment.GetEnvironmentVariable("SERVER_SSL_CERTIFICATE");
    var keyPath = Environment.GetEnvironmentVariable("SERVER_SSL_CERTIFICATE_PRIVATE_KEY");
    if (string.IsNullOrWhiteSpace(certPath) || string.IsNullOrWhiteSpace(keyPath))
    {
        throw new InvalidOperationException("SERVER_SSL_CERTIFICATE and SERVER_SSL_CERTIFICATE_PRIVATE_KEY are required when SERVER_SSL_ENABLED=true.");
    }

    options.ListenAnyIP(httpsPort, listen => listen.UseHttps(X509Certificate2.CreateFromPemFile(certPath, keyPath)));
});

var app = builder.Build();

app.MapHealthEndpoints();
app.MapBookingEndpoints();

app.Run();

static int ParsePort(string? value, int fallback)
{
    return int.TryParse(value, out var parsedPort) && parsedPort > 0 ? parsedPort : fallback;
}
