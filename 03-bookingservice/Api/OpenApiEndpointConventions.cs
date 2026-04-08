using Microsoft.AspNetCore.OpenApi;
using Microsoft.OpenApi.Models;

namespace bookingservice.Api;

public record ErrorResponse(string Code, string Message);

public static class OpenApiEndpointConventions
{
    public static RouteHandlerBuilder WithRequestContextHeaders(this RouteHandlerBuilder builder, bool includeIdempotencyHeaders = false)
    {
        return builder.WithOpenApi(operation =>
        {
            operation.Parameters ??= new List<OpenApiParameter>();

            AddHeader(operation, "X-User-Id", "Optional caller identifier. Defaults to U-DEFAULT when omitted.");
            AddHeader(operation, "X-Actor-Type", "Optional actor type. Supported values: customer, corp.");
            AddHeader(operation, "X-Realm", "Optional realm fallback used to infer actor type when X-Actor-Type is omitted.");
            AddHeader(operation, "X-Correlation-Id", "Optional correlation identifier used for downstream tracing.");

            if (includeIdempotencyHeaders)
            {
                AddHeader(operation, "Idempotency-Key", "Optional idempotency key for safe retries on mutating endpoints.");
                AddHeader(operation, "X-Idempotency-Key", "Legacy alias for Idempotency-Key.");
            }

            return operation;
        });
    }

    private static void AddHeader(OpenApiOperation operation, string name, string description)
    {
        if (operation.Parameters!.Any(parameter =>
            parameter.In == ParameterLocation.Header &&
            string.Equals(parameter.Name, name, StringComparison.OrdinalIgnoreCase)))
        {
            return;
        }

        operation.Parameters.Add(new OpenApiParameter
        {
            Name = name,
            In = ParameterLocation.Header,
            Description = description,
            Required = false
        });
    }
}
