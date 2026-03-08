namespace bookingservice.Domain;

public interface IBookingRepository
{
    Booking Save(Booking booking);
    Booking? FindById(string bookingId);
    IReadOnlyCollection<Booking> FindAll();
}
