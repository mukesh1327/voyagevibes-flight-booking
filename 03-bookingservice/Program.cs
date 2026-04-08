using System.Security.Cryptography.X509Certificates;
using bookingservice.Api;
using bookingservice.Application;
using bookingservice.Domain;
using bookingservice.Infrastructure;
using bookingservice.Messaging;
using Microsoft.Extensions.Options;
using OpenTelemetry;
using OpenTelemetry.Logs;
using OpenTelemetry.Metrics;
using OpenTelemetry.Resources;
using OpenTelemetry.Trace;
using Microsoft.OpenApi.Models;

var builder = WebApplication.CreateBuilder(args);

var activeEnv = (Environment.GetEnvironmentVariable("APP_ENV") ?? "dev").Trim().ToLowerInvariant();
if (activeEnv is not ("dev" or "prod"))
{
    activeEnv = "dev";
}

builder.Configuration.AddJsonFile($"appsettings.{activeEnv}.json", optional: true, reloadOnChange: true);

if (IsOtelEnabled())
{
    ConfigureOpenTelemetry(builder);
}

builder.Services.Configure<BookingServiceOptions>(builder.Configuration.GetSection("BookingService"));
builder.Services.Configure<FlightServiceOptions>(builder.Configuration.GetSection("ExternalServices:Flight"));
builder.Services.Configure<KafkaOptions>(builder.Configuration.GetSection("Kafka"));
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(options =>
{
    options.SwaggerDoc("v1", new OpenApiInfo
    {
        Title = "Booking Service API",
        Version = "v1",
        Description = "HTTP API for booking lifecycle operations and service health checks."
    });
});

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

app.UseSwagger();
app.UseSwaggerUI(options =>
{
    options.SwaggerEndpoint("/swagger/v1/swagger.json", "Booking Service API v1");
    options.DocumentTitle = "Booking Service Swagger";
});

app.MapHealthEndpoints();
app.MapBookingEndpoints();

app.Run();

static int ParsePort(string? value, int fallback)
{
    return int.TryParse(value, out var parsedPort) && parsedPort > 0 ? parsedPort : fallback;
}

static bool IsOtelEnabled()
{
    var enabled = Environment.GetEnvironmentVariable("OTEL_ENABLED") ?? "false";
    var disabled = Environment.GetEnvironmentVariable("OTEL_SDK_DISABLED") ?? "true";
    return enabled.Equals("true", StringComparison.OrdinalIgnoreCase)
        && !disabled.Equals("true", StringComparison.OrdinalIgnoreCase);
}

static void ConfigureOpenTelemetry(WebApplicationBuilder builder)
{
    var serviceName = Environment.GetEnvironmentVariable("OTEL_SERVICE_NAME") ?? "booking-service";
    var endpointRaw = Environment.GetEnvironmentVariable("OTEL_EXPORTER_OTLP_ENDPOINT") ?? "http://opentelemetry-collector:4317";
    var protocolRaw = Environment.GetEnvironmentVariable("OTEL_EXPORTER_OTLP_PROTOCOL") ?? "grpc";

    var resourceBuilder = ResourceBuilder.CreateDefault()
        .AddService(serviceName, serviceNamespace: "voyagevibes");

    builder.Logging.AddOpenTelemetry(options =>
    {
        options.SetResourceBuilder(resourceBuilder);
        options.IncludeScopes = true;
        options.ParseStateValues = true;
        options.AddOtlpExporter(otlpOptions =>
        {
            otlpOptions.Endpoint = new Uri(endpointRaw);
            otlpOptions.Protocol = protocolRaw.Contains("http", StringComparison.OrdinalIgnoreCase)
                ? OpenTelemetry.Exporter.OtlpExportProtocol.HttpProtobuf
                : OpenTelemetry.Exporter.OtlpExportProtocol.Grpc;
        });
    });

    builder.Services.AddOpenTelemetry()
        .ConfigureResource(rb => rb.AddService(serviceName, serviceNamespace: "voyagevibes"))
        .WithTracing(tracing =>
        {
            tracing
                .AddAspNetCoreInstrumentation()
                .AddHttpClientInstrumentation()
                .AddOtlpExporter(otlpOptions =>
                {
                    otlpOptions.Endpoint = new Uri(endpointRaw);
                    otlpOptions.Protocol = protocolRaw.Contains("http", StringComparison.OrdinalIgnoreCase)
                        ? OpenTelemetry.Exporter.OtlpExportProtocol.HttpProtobuf
                        : OpenTelemetry.Exporter.OtlpExportProtocol.Grpc;
                });
        })
        .WithMetrics(metrics =>
        {
            metrics
                .AddAspNetCoreInstrumentation()
                .AddRuntimeInstrumentation()
                .AddOtlpExporter(otlpOptions =>
                {
                    otlpOptions.Endpoint = new Uri(endpointRaw);
                    otlpOptions.Protocol = protocolRaw.Contains("http", StringComparison.OrdinalIgnoreCase)
                        ? OpenTelemetry.Exporter.OtlpExportProtocol.HttpProtobuf
                        : OpenTelemetry.Exporter.OtlpExportProtocol.Grpc;
                });
        });
}
