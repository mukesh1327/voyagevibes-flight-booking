CREATE TABLE IF NOT EXISTS flights (
  flight_id VARCHAR(32) PRIMARY KEY,
  airline VARCHAR(128) NOT NULL,
  origin_code VARCHAR(8) NOT NULL,
  destination_code VARCHAR(8) NOT NULL,
  departure_at TIMESTAMP NOT NULL,
  arrival_at TIMESTAMP NOT NULL,
  base_fare INT NOT NULL,
  total_seats INT NOT NULL,
  available_seats INT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_flights_route (origin_code, destination_code),
  INDEX idx_flights_departure (departure_at),
  CONSTRAINT chk_flight_seats_non_negative CHECK (total_seats >= 0 AND available_seats >= 0),
  CONSTRAINT chk_flight_available_not_more_than_total CHECK (available_seats <= total_seats)
);

INSERT INTO flights (
  flight_id, airline, origin_code, destination_code, departure_at, arrival_at, base_fare, total_seats, available_seats
) VALUES
  ('FL-1001', 'VoyageVibes', 'DEL', 'BOM', '2026-03-10 09:00:00', '2026-03-10 11:10:00', 5800, 180, 18),
  ('FL-1002', 'VoyageVibes', 'DEL', 'BLR', '2026-03-10 12:00:00', '2026-03-10 14:50:00', 6400, 180, 9),
  ('FL-1003', 'CloudAir', 'BOM', 'DEL', '2026-03-10 15:30:00', '2026-03-10 17:40:00', 5600, 180, 24),
  ('FL-1004', 'CloudAir', 'DEL', 'BOM', '2026-03-10 19:00:00', '2026-03-10 21:20:00', 5200, 180, 0),
  ('FL-1005', 'VoyageVibes', 'BLR', 'HYD', '2026-03-10 08:15:00', '2026-03-10 09:30:00', 4500, 180, 6)
ON DUPLICATE KEY UPDATE
  flight_id = flight_id;
