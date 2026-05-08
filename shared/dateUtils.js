export function getTodayISO() {
  return new Date().toISOString().split('T')[0];
}

export function formatDate(isoString) {
  return new Date(isoString).toLocaleDateString('en-PK', {
    day: 'numeric', month: 'short', year: 'numeric'
  });
}

export function formatTime(timeStr) {
  // timeStr: "09:00"
  const [h, m] = timeStr.split(':');
  const date = new Date();
  date.setHours(+h, +m);
  return date.toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit' });
}

export function isTimePast(timeStr) {
  const [h, m] = timeStr.split(':');
  const now = new Date();
  return now.getHours() > +h || (now.getHours() === +h && now.getMinutes() >= +m);
}

export function getWeekdayName(date) {
  return new Date(date).toLocaleDateString('en-US', { weekday: 'long' });
}