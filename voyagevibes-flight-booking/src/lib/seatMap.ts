interface SeatCell {
  code: string;
  premium: boolean;
  unavailable: boolean;
}

interface SeatRow {
  row: number;
  left: SeatCell[];
  right: SeatCell[];
}

const unavailableSeats = new Set(['2C', '4D', '6F', '7A', '8B', '10E']);

export const buildSeatLayout = (): SeatRow[] => (
  Array.from({ length: 10 }, (_, rowIndex) => {
    const row = rowIndex + 1;
    const premium = row <= 2;
    const seats = ['A', 'B', 'C', 'D', 'E', 'F'].map((column) => ({
      code: `${row}${column}`,
      premium,
      unavailable: unavailableSeats.has(`${row}${column}`),
    }));

    return {
      row,
      left: seats.slice(0, 3),
      right: seats.slice(3),
    };
  })
);
