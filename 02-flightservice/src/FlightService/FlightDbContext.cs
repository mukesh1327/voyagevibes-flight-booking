using Microsoft.EntityFrameworkCore;

namespace FlightService;

public sealed class FlightDbContext(DbContextOptions<FlightDbContext> options) : DbContext(options)
{
    public DbSet<Flight> Flights => Set<Flight>();
    public DbSet<FlightHold> Holds => Set<FlightHold>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Flight>(entity =>
        {
            entity.ToTable("flights");
            entity.HasKey(item => item.Id);
            entity.Property(item => item.FlightNo).HasMaxLength(20).IsRequired();
            entity.Property(item => item.Origin).HasMaxLength(3).IsRequired();
            entity.Property(item => item.Destination).HasMaxLength(3).IsRequired();
            entity.Property(item => item.Price).HasColumnType("decimal(12,2)");
            entity.HasIndex(item => new { item.Origin, item.Destination, item.DepartureTime });
        });

        modelBuilder.Entity<FlightHold>(entity =>
        {
            entity.ToTable("holds");
            entity.HasKey(item => item.Id);
            entity.Property(item => item.Status).HasMaxLength(20).IsRequired();
            entity.HasIndex(item => new { item.Status, item.ExpiresAt });
        });
    }
}
