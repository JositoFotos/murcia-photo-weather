export function calculateSunTimes(date, latitude, longitude) {
  if (!window.SunCalc) throw new Error('SunCalc no está disponible.');
  const result = window.SunCalc.getTimes(new Date(`${date}T12:00:00`), latitude, longitude);
  window.SunCalc.addTime(-4, 'morningBlueHourStart', 'eveningBlueHourStart');
  window.SunCalc.addTime(-8, 'morningBlueHourEnd', 'eveningBlueHourEnd');
  const times = window.SunCalc.getTimes(new Date(`${date}T12:00:00`), latitude, longitude);
  return {
    ...times,
    blueMorning: [times.morningBlueHourStart, times.morningBlueHourEnd],
    blueEvening: [times.eveningBlueHourEnd, times.eveningBlueHourStart],
    goldenMorning: [times.sunrise, times.goldenHourEnd],
    goldenEvening: [times.goldenHour, times.sunset],
    dayLengthMs: times.sunset && times.sunrise ? times.sunset - times.sunrise : null
  };
}

export function calculateGoldenHour(times) {
  return { morning: times.goldenMorning, evening: times.goldenEvening };
}

export function calculateBlueHour(times) {
  return { morning: times.blueMorning, evening: times.blueEvening };
}

export function formatTime(date, timeZone = 'Europe/Madrid') {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return 'N/D';
  return new Intl.DateTimeFormat('es-ES', { hour: '2-digit', minute: '2-digit', timeZone }).format(date);
}

export function formatRange(range, timeZone) {
  if (!range?.[0] || !range?.[1]) return 'N/D';
  return `${formatTime(range[0], timeZone)}–${formatTime(range[1], timeZone)}`;
}
