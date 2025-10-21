import {
  loadScheduleRules,
  officialPdfUrl,
  sourceReference,
  collectionAreas,
  weekdayNames,
} from '../data/schedule.js';

const calendarElement = document.getElementById('calendar');
const legendElement = document.getElementById('legend');
const monthLabelElement = document.getElementById('current-month');
const prevMonthButton = document.getElementById('prev-month');
const nextMonthButton = document.getElementById('next-month');
const upcomingListElement = document.getElementById('upcoming-list');
const pdfLinkElement = document.getElementById('pdf-link');

if (pdfLinkElement) {
  pdfLinkElement.href = officialPdfUrl;
  pdfLinkElement.setAttribute('download', 'yabunishi-garbage-schedule.pdf');
  pdfLinkElement.title = `${collectionAreas.name}の公式ごみ収集カレンダー（PDF）`;
  pdfLinkElement.rel = 'noopener';
}

const today = new Date();
let activeYear = today.getFullYear();
let activeMonth = today.getMonth();
let scheduleRules = [];

prevMonthButton.disabled = true;
nextMonthButton.disabled = true;

function formatDateKey(date) {
  return date.toISOString().split('T')[0];
}

function getOrdinalInMonth(date) {
  return Math.floor((date.getDate() - 1) / 7) + 1;
}

function occursOnDate(rule, date) {
  if (rule.type === 'weekly') {
    return rule.weekdays.includes(date.getDay());
  }

  if (rule.type === 'monthly') {
    if (date.getDay() !== rule.weekday) return false;
    const ordinal = getOrdinalInMonth(date);
    return rule.ordinals.includes(ordinal);
  }

  return false;
}

function buildScheduleMap(year, month) {
  const start = new Date(year, month, 1);
  const startOffset = start.getDay();
  const gridStart = new Date(year, month, 1 - startOffset);
  const scheduleMap = new Map();

  for (let i = 0; i < 42; i += 1) {
    const current = new Date(gridStart);
    current.setDate(gridStart.getDate() + i);
    const events = scheduleRules.filter((rule) => occursOnDate(rule, current));

    if (events.length > 0) {
      scheduleMap.set(formatDateKey(current), events);
    }
  }

  return scheduleMap;
}

function renderLegend() {
  legendElement.innerHTML = '';

  const areaDescription = document.createElement('p');
  areaDescription.className = 'legend-area';
  areaDescription.textContent = collectionAreas.note;

  if (sourceReference) {
    const br = document.createElement('br');
    const link = document.createElement('a');
    link.href = sourceReference;
    link.target = '_blank';
    link.rel = 'noopener';
    link.textContent = '枚方市公式サイトで確認する';
    link.className = 'legend-source-link';
    areaDescription.appendChild(br);
    areaDescription.appendChild(link);
  }

  legendElement.appendChild(areaDescription);

  scheduleRules.forEach((rule) => {
    const item = document.createElement('div');
    item.className = 'legend-item';

    const swatch = document.createElement('span');
    swatch.className = 'legend-swatch';
    swatch.style.backgroundColor = rule.color;

    const label = document.createElement('span');
    label.textContent = rule.name;

    item.appendChild(swatch);
    item.appendChild(label);
    legendElement.appendChild(item);
  });
}

function renderCalendar(year, month) {
  const scheduleMap = buildScheduleMap(year, month);
  const current = new Date(year, month, 1);
  const startOffset = current.getDay();
  const gridStart = new Date(year, month, 1 - startOffset);
  const todayKey = formatDateKey(today);

  calendarElement.innerHTML = '';

  weekdayNames.forEach((weekday) => {
    const headerCell = document.createElement('div');
    headerCell.className = 'calendar-header';
    headerCell.textContent = weekday;
    calendarElement.appendChild(headerCell);
  });

  for (let i = 0; i < 42; i += 1) {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + i);
    const dateKey = formatDateKey(date);
    const cell = document.createElement('div');
    cell.className = 'calendar-cell';

    if (date.getMonth() !== month) {
      cell.classList.add('outside-month');
    }

    if (dateKey === todayKey) {
      cell.classList.add('today');
      cell.setAttribute('aria-current', 'date');
    }

    const dateLabel = document.createElement('span');
    dateLabel.className = 'date-label';
    dateLabel.textContent = `${date.getDate()}`;
    cell.appendChild(dateLabel);

    const events = scheduleMap.get(dateKey) ?? [];
    events.forEach((event) => {
      const pill = document.createElement('span');
      pill.className = 'event-pill';
      pill.style.backgroundColor = event.color;
      pill.textContent = event.name;
      pill.title = event.description;
      cell.appendChild(pill);
    });

    calendarElement.appendChild(cell);
  }

  monthLabelElement.textContent = new Intl.DateTimeFormat('ja-JP', {
    year: 'numeric',
    month: 'long',
  }).format(new Date(year, month, 1));
}

function findUpcomingEvents(limit = 6) {
  const results = [];
  const cursor = new Date(today);
  cursor.setHours(0, 0, 0, 0);

  let attempts = 0;
  const safetyLimit = 180;

  while (results.length < limit && attempts < safetyLimit) {
    const events = scheduleRules.filter((rule) => occursOnDate(rule, cursor));
    if (events.length > 0) {
      results.push({ date: new Date(cursor), events });
    }

    cursor.setDate(cursor.getDate() + 1);
    attempts += 1;
  }

  return results;
}

function renderUpcoming() {
  upcomingListElement.innerHTML = '';
  const upcoming = findUpcomingEvents();

  upcoming.forEach(({ date, events }) => {
    const item = document.createElement('li');

    const formattedDate = new Intl.DateTimeFormat('ja-JP', {
      month: 'numeric',
      day: 'numeric',
      weekday: 'short',
    }).format(date);

    const dateEl = document.createElement('span');
    dateEl.className = 'upcoming-date';
    dateEl.textContent = formattedDate;

    const categories = document.createElement('div');
    categories.className = 'upcoming-categories';

    events.forEach((event) => {
      const pill = document.createElement('span');
      pill.className = 'event-pill';
      pill.style.backgroundColor = event.color;
      pill.textContent = event.name;
      pill.title = event.description;
      categories.appendChild(pill);
    });

    const descriptionList = document.createElement('ul');
    descriptionList.className = 'upcoming-descriptions';

    events.forEach((event) => {
      const li = document.createElement('li');
      li.textContent = event.description;
      descriptionList.appendChild(li);
    });

    item.appendChild(dateEl);
    item.appendChild(categories);
    item.appendChild(descriptionList);

    upcomingListElement.appendChild(item);
  });
}

function showLoadingState() {
  legendElement.innerHTML = '';
  const legendMessage = document.createElement('p');
  legendMessage.className = 'status-message';
  legendMessage.textContent = 'ごみ出し情報を読み込み中です…';
  legendElement.appendChild(legendMessage);

  calendarElement.innerHTML = '';
  const calendarMessage = document.createElement('p');
  calendarMessage.className = 'status-message';
  calendarMessage.textContent = 'カレンダーを読み込み中…';
  calendarElement.appendChild(calendarMessage);

  upcomingListElement.innerHTML = '';
  const upcomingMessage = document.createElement('li');
  upcomingMessage.className = 'status-message';
  upcomingMessage.textContent = '収集予定を読み込み中です…';
  upcomingListElement.appendChild(upcomingMessage);
}

function showScheduleLoadError(message) {
  const errorText =
    message ?? 'ごみ出し情報を読み込めませんでした。時間を置いて再度お試しください。';

  legendElement.innerHTML = '';
  const legendError = document.createElement('p');
  legendError.className = 'status-message error';
  legendError.textContent = errorText;
  legendElement.appendChild(legendError);

  calendarElement.innerHTML = '';
  const calendarError = document.createElement('p');
  calendarError.className = 'status-message error';
  calendarError.textContent = 'カレンダーを表示できません。';
  calendarElement.appendChild(calendarError);

  upcomingListElement.innerHTML = '';
  const upcomingError = document.createElement('li');
  upcomingError.className = 'status-message error';
  upcomingError.textContent = '収集予定を取得できませんでした。';
  upcomingListElement.appendChild(upcomingError);
}

prevMonthButton.addEventListener('click', () => {
  if (scheduleRules.length === 0) {
    return;
  }

  if (activeMonth === 0) {
    activeMonth = 11;
    activeYear -= 1;
  } else {
    activeMonth -= 1;
  }
  renderCalendar(activeYear, activeMonth);
});

nextMonthButton.addEventListener('click', () => {
  if (scheduleRules.length === 0) {
    return;
  }

  if (activeMonth === 11) {
    activeMonth = 0;
    activeYear += 1;
  } else {
    activeMonth += 1;
  }
  renderCalendar(activeYear, activeMonth);
});

async function init() {
  showLoadingState();

  try {
    scheduleRules = await loadScheduleRules();

    if (scheduleRules.length === 0) {
      showScheduleLoadError('CSVにごみ出し情報が含まれていません。');
      return;
    }

    prevMonthButton.disabled = false;
    nextMonthButton.disabled = false;

    renderLegend();
    renderCalendar(activeYear, activeMonth);
    renderUpcoming();
  } catch (error) {
    console.error('Failed to load schedule rules from CSV.', error);
    showScheduleLoadError();
  }
}

init();
