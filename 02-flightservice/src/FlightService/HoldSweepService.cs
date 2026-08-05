using Microsoft.EntityFrameworkCore;

namespace FlightService;

/// <summary>
/// Reclaims seats from holds that were never confirmed or explicitly released before they expired.
/// Without this sweep, an abandoned checkout would leak inventory permanently.
/// </summary>
public sealed class HoldSweepService(IServiceScopeFactory scopeFactory, ILogger<HoldSweepService> logger) : BackgroundService
{
    private static readonly TimeSpan Interval = TimeSpan.FromSeconds(30);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(Interval);
        do
        {
            try
            {
                await SweepOnceAsync(stoppingToken);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                logger.LogError(ex, "Hold sweep iteration failed");
            }
        } while (await timer.WaitForNextTickAsync(stoppingToken));
    }

    private async Task SweepOnceAsync(CancellationToken cancellationToken)
    {
        using var scope = scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<FlightDbContext>();
        var now = DateTimeOffset.UtcNow;

        var expiredHoldIds = await db.Holds.AsNoTracking()
            .Where(hold => hold.Status == HoldStatus.Active && hold.ExpiresAt < now)
            .Select(hold => hold.Id)
            .ToListAsync(cancellationToken);

        if (expiredHoldIds.Count == 0)
        {
            return;
        }

        var service = scope.ServiceProvider.GetRequiredService<FlightSearchService>();
        var releasedCount = 0;
        foreach (var holdId in expiredHoldIds)
        {
            var result = await service.ReleaseHoldAsync(holdId, cancellationToken);
            if (result == HoldTransitionResult.Applied)
            {
                releasedCount++;
            }
        }

        if (releasedCount > 0)
        {
            logger.LogInformation("Hold sweep released {ReleasedCount} expired hold(s), reclaiming seats", releasedCount);
        }
    }
}
