const RAD = Math.PI / 180;
const DEG = 180 / Math.PI;
const GALACTIC_CENTER = { raDeg: 266.4167, decDeg: -29.0078 };
const SYNODIC_MONTH = 29.530588853;

function asDate(value) {
  const d = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function localDateAtHour(dateISO, hour) {
  const d = new Date(`${dateISO}T00:00:00`);
  d.setHours(d.getHours() + hour);
  return d;
}

export function calculateSunTimes(date, latitude, longitude) {
  if (!window.SunCalc) throw new Error('SunCalc no está disponible.');
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

export function getMoonData(dateISO, latitude, longitude, timeZone = 'Europe/Madrid') {
  if (!window.SunCalc) throw new Error('SunCalc no está disponible.');
  const midday = new Date(`${dateISO}T12:00:00`);
  const illumination = window.SunCalc.getMoonIllumination(midday);
  const times = window.SunCalc.getMoonTimes(midday, latitude, longitude, false);
  const positionAtNoon = window.SunCalc.getMoonPosition(midday, latitude, longitude);
  const phase = normalize(illumination.phase);
  return {
    fraction: illumination.fraction,
    phase,
    waxing: illumination.waxing !== false,
    name: moonPhaseName(phase),
    icon: moonPhaseIcon(phase),
    rise: times.rise ?? null,
    set: times.set ?? null,
    alwaysUp: Boolean(times.alwaysUp),
    alwaysDown: Boolean(times.alwaysDown),
    altitude: positionAtNoon.altitude,
    azimuth: positionAtNoon.azimuth,
    distance: positionAtNoon.distance,
    illuminationPercent: Math.round(illumination.fraction * 100),
    timeZone
  };
}

export function calculateMilkyWay(dateISO, latitude, longitude, sunTimes, moonData) {
  const samples = [];
  for (let i = 0; i <= 24 * 2; i += 1) {
    samples.push(localDateAtHour(dateISO, i / 2));
  }
  const candidates = samples.map((date) => {
    const sun = window.SunCalc.getPosition(date, latitude, longitude);
    const gst = greenwichSiderealTime(date);
    const lst = normalizeDegrees(gst + longitude);
    const hourAngle = normalizeDegrees(lst - GALACTIC_CENTER.raDeg);
    const altitude = Math.asin(
      Math.sin(GALACTIC_CENTER.decDeg * RAD) * Math.sin(latitude * RAD) +
      Math.cos(GALACTIC_CENTER.decDeg * RAD) * Math.cos(latitude * RAD) * Math.cos(hourAngle * RAD)
    ) * DEG;
    const dark = sun.altitude <= -18 * RAD;
    return { date, altitude, dark };
  });
  const darkCandidates = candidates.filter(x => x.dark && x.altitude >= 10);
  const best = [...candidates].sort((a, b) => b.altitude - a.altitude)[0] ?? candidates[0];
  const bestDark = [...darkCandidates].sort((a, b) => b.altitude - a.altitude)[0] ?? null;
  const darkStart = sunTimes?.night ?? sunTimes?.nauticalDusk ?? null;
  const darkEnd = sunTimes?.nightEnd ?? sunTimes?.nauticalDawn ?? null;
  const peak = bestDark ?? best;
  let score = 0;
  if (moonData) score += moonData.illuminationPercent <= 15 ? 40 : moonData.illuminationPercent <= 35 ? 27 : moonData.illuminationPercent <= 60 ? 15 : 5;
  score += peak.altitude >= 60 ? 40 : peak.altitude >= 40 ? 32 : peak.altitude >= 25 ? 22 : peak.altitude >= 10 ? 12 : 0;
  if (bestDark) score += 20;
  score = Math.max(0, Math.min(100, Math.round(score)));
  const visible = Boolean(bestDark && bestDark.altitude > 0);
  return {
    visible,
    score,
    bestAltitude: peak?.altitude ?? null,
    bestTime: peak?.date ?? null,
    darkStart,
    darkEnd,
    centerAzimuth: galacticCenterAzimuth(peak?.date ?? new Date(), latitude, longitude),
    note: visible ? 'El centro galáctico supera los 0° de altura durante horas de oscuridad.' : 'No se detecta una ventana nocturna favorable para el centro galáctico en esta fecha.'
  };
}

export function calculateAstronomicalEvents(dateISO, latitude, longitude, timeZone = 'Europe/Madrid') {
  const events = [];
  const base = new Date(`${dateISO}T12:00:00`);
  const moon = getMoonData(dateISO, latitude, longitude, timeZone);
  if (moon.rise) events.push({ date: moon.rise, icon: '🌙', title: 'Salida de la Luna', detail: formatTime(moon.rise, timeZone) });
  if (moon.set) events.push({ date: moon.set, icon: '🌙', title: 'Puesta de la Luna', detail: formatTime(moon.set, timeZone) });

  const phaseEvents = findNearbyLunarPhases(base, timeZone);
  phaseEvents.forEach(evt => events.push(evt));

  const solar = seasonalEvents(base.getFullYear(), timeZone);
  solar.forEach(evt => {
    const delta = Math.abs(evt.date.getTime() - base.getTime());
    if (delta <= 45 * 86400000) events.push(evt);
  });

  return events.sort((a, b) => a.date - b.date).slice(0, 8);
}

function findNearbyLunarPhases(baseDate, timeZone) {
  const targets = [
    { target: 0, name: 'Luna nueva', icon: '🌑' },
    { target: 0.25, name: 'Cuarto creciente', icon: '🌓' },
    { target: 0.5, name: 'Luna llena', icon: '🌕' },
    { target: 0.75, name: 'Cuarto menguante', icon: '🌗' }
  ];
  const found = [];
  for (const t of targets) {
    let best = null;
    for (let offset = -20; offset <= 20; offset += 0.25) {
      const d = new Date(baseDate.getTime() + offset * 86400000);
      const phase = normalize(window.SunCalc.getMoonIllumination(d).phase);
      const distance = circularPhaseDistance(phase, t.target);
      if (!best || distance < best.distance) best = { d, distance };
    }
    if (best && best.distance < 0.015) {
      const day = new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: '2-digit', timeZone }).format(best.d);
      const sameDay = found.some(x => x.date.toDateString() === best.d.toDateString());
      if (!sameDay) found.push({ date: best.d, icon: t.icon, title: t.name, detail: day });
    }
  }
  return found;
}

function seasonalEvents(year, timeZone) {
  // Calendar approximation useful for planning; exact event moments are intentionally not claimed.
  const specs = [
    [new Date(`${year}-03-20T12:00:00`), 'Equinoccio de primavera', '☀️'],
    [new Date(`${year}-06-21T12:00:00`), 'Solsticio de verano', '☀️'],
    [new Date(`${year}-09-23T12:00:00`), 'Equinoccio de otoño', '🍂'],
    [new Date(`${year}-12-21T12:00:00`), 'Solsticio de invierno', '❄️']
  ];
  return specs.map(([date, title, icon]) => ({ date, title, icon, detail: new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: '2-digit', timeZone }).format(date) }));
}

function moonPhaseName(phase) {
  if (phase < 0.03 || phase >= 0.97) return 'Luna nueva';
  if (phase < 0.22) return 'Creciente';
  if (phase < 0.28) return 'Cuarto creciente';
  if (phase < 0.47) return 'Gibosa creciente';
  if (phase < 0.53) return 'Luna llena';
  if (phase < 0.72) return 'Gibosa menguante';
  if (phase < 0.78) return 'Cuarto menguante';
  return 'Menguante';
}

function moonPhaseIcon(phase) {
  if (phase < 0.03 || phase >= 0.97) return '🌑';
  if (phase < 0.28) return '🌒';
  if (phase < 0.53) return '🌔';
  if (phase < 0.78) return '🌖';
  return '🌘';
}

function circularPhaseDistance(a, b) {
  const d = Math.abs(a - b);
  return Math.min(d, 1 - d);
}

function normalize(value) {
  return ((value % 1) + 1) % 1;
}

function normalizeDegrees(value) {
  return ((value % 360) + 360) % 360;
}

function greenwichSiderealTime(date) {
  const jd = date.getTime() / 86400000 + 2440587.5;
  const T = (jd - 2451545.0) / 36525;
  return normalizeDegrees(280.46061837 + 360.98564736629 * (jd - 2451545.0) + 0.000387933 * T * T - T * T * T / 38710000);
}

function galacticCenterAzimuth(date, latitude, longitude) {
  const gst = greenwichSiderealTime(date);
  const lst = normalizeDegrees(gst + longitude);
  const H = normalizeDegrees(lst - GALACTIC_CENTER.raDeg) * RAD;
  const dec = GALACTIC_CENTER.decDeg * RAD;
  const lat = latitude * RAD;
  const az = Math.atan2(
    Math.sin(H),
    Math.cos(H) * Math.sin(lat) - Math.tan(dec) * Math.cos(lat)
  ) * DEG;
  return normalizeDegrees(az + 180);
}
