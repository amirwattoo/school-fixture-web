export const localDateValue = (date: Date = new Date()) =>
  `${date.getFullYear().toString().padStart(4, "0")}-${(date.getMonth() + 1)
    .toString()
    .padStart(2, "0")}-${date.getDate().toString().padStart(2, "0")}`;

export const isoWeekForLocalDate = (date: Date = new Date()) => {
  const target = new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()),
  );
  const dayNumber = target.getUTCDay() || 7;
  target.setUTCDate(target.getUTCDate() + 4 - dayNumber);
  const year = target.getUTCFullYear();
  const yearStart = new Date(Date.UTC(year, 0, 1));
  return {
    year,
    weekNumber: Math.ceil(
      ((target.getTime() - yearStart.getTime()) / 86400000 + 1) / 7,
    ),
  };
};
