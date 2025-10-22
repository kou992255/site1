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
const notificationSection = document.getElementById('notification-settings');
const notificationSupportMessageElement = document.getElementById(
  'notification-support-message',
);
const notificationControlsElement = document.getElementById('notification-controls');
const defaultAlertToggle = document.getElementById('default-alert-toggle');
const customAlertForm = document.getElementById('custom-alert-form');
const customAlertTimeInput = document.getElementById('custom-alert-time');
const customAlertCategoriesContainer = document.getElementById(
  'custom-alert-categories',
);
const customAlertListElement = document.getElementById('custom-alert-list');

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

const NotificationManager = (() => {
  if (!notificationSection) {
    return {
      init() {},
      setScheduleRules() {},
    };
  }

  const STORAGE_KEY = 'yabunishi-notifications';
  const LOOKAHEAD_DAYS = 21;
  const DEFAULT_TIME = '20:00';
  const ICON_PATH = 'icons/icon-192.png';
  const notificationsSupported = 'Notification' in window && 'serviceWorker' in navigator;

  const state = {
    settings: {
      defaultEnabled: true,
      customAlerts: [],
    },
    rules: [],
    ruleMap: new Map(),
    rulesReady: false,
    timeouts: [],
  };

  const collectionFormatter = new Intl.DateTimeFormat('ja-JP', {
    month: 'numeric',
    day: 'numeric',
    weekday: 'short',
  });

  function setMessage(text) {
    if (notificationSupportMessageElement) {
      notificationSupportMessageElement.textContent = text;
    }
  }

  function sanitizeTime(value) {
    if (typeof value !== 'string') {
      return DEFAULT_TIME;
    }

    const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value.trim());
    if (!match) {
      return DEFAULT_TIME;
    }

    return `${match[1]}:${match[2]}`;
  }

  function normalizeAlert(rawAlert) {
    if (!rawAlert || typeof rawAlert !== 'object') {
      return null;
    }

    const id = typeof rawAlert.id === 'string' ? rawAlert.id : null;
    if (!id) {
      return null;
    }

    const time = sanitizeTime(rawAlert.time);
    const categories = Array.isArray(rawAlert.categories)
      ? Array.from(
          new Set(
            rawAlert.categories
              .map((value) => (typeof value === 'string' ? value : ''))
              .filter((value) => value !== ''),
          ),
        )
      : [];

    if (categories.length === 0) {
      return null;
    }

    return { id, time, categories };
  }

  function loadSettings() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) {
        return { defaultEnabled: true, customAlerts: [] };
      }

      const parsed = JSON.parse(stored);
      const defaultEnabled =
        parsed && typeof parsed.defaultEnabled === 'boolean' ? parsed.defaultEnabled : true;
      const customAlerts = parsed && Array.isArray(parsed.customAlerts)
        ? parsed.customAlerts.map((alert) => normalizeAlert(alert)).filter(Boolean)
        : [];

      return { defaultEnabled, customAlerts };
    } catch (error) {
      console.warn('通知設定の読み込みに失敗しました。初期値を使用します。', error);
      return { defaultEnabled: true, customAlerts: [] };
    }
  }

  function saveSettings() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.settings));
  }

  function updateSupportUi() {
    if (!notificationControlsElement) {
      return;
    }

    if (!notificationsSupported) {
      notificationControlsElement.classList.add('hidden');
      setMessage('お使いのブラウザでは通知機能をご利用いただけません。');
    } else {
      notificationControlsElement.classList.remove('hidden');
    }
  }

  function updateStatusMessage() {
    if (!notificationsSupported) {
      return;
    }

    if (Notification.permission === 'denied') {
      setMessage('通知がブロックされています。ブラウザや端末の設定で許可してください。');
      return;
    }

    if (!state.settings.defaultEnabled && state.settings.customAlerts.length === 0) {
      setMessage('通知を受け取るには上の設定で通知をオンにしてください。');
      return;
    }

    if (Notification.permission === 'default') {
      setMessage('通知を受け取るには「許可」を選択してください。');
      return;
    }

    setMessage('通知は有効です。前日の指定時間にお知らせします。');
  }

  function renderCustomAlerts() {
    if (!customAlertListElement) {
      return;
    }

    customAlertListElement.innerHTML = '';

    if (state.settings.customAlerts.length === 0) {
      const emptyItem = document.createElement('li');
      emptyItem.className = 'notification-list-item';
      const message = document.createElement('p');
      message.className = 'notification-empty-message';
      message.textContent = 'カスタム通知はまだありません。';
      emptyItem.appendChild(message);
      customAlertListElement.appendChild(emptyItem);
      return;
    }

    state.settings.customAlerts.forEach((alert) => {
      const item = document.createElement('li');
      item.className = 'notification-list-item';

      const header = document.createElement('div');
      header.className = 'notification-item-header';

      const time = document.createElement('span');
      time.className = 'notification-item-time';
      time.textContent = `前日 ${alert.time}`;

      const removeButton = document.createElement('button');
      removeButton.type = 'button';
      removeButton.className = 'notification-remove-button';
      removeButton.setAttribute('data-remove-alert', alert.id);
      removeButton.textContent = '削除';

      header.appendChild(time);
      header.appendChild(removeButton);

      const categories = document.createElement('p');
      categories.className = 'notification-item-categories';
      const categoryNames = alert.categories
        .map((id) => state.ruleMap.get(id)?.name ?? id)
        .join('・');
      categories.textContent = `対象: ${categoryNames}`;

      item.appendChild(header);
      item.appendChild(categories);
      customAlertListElement.appendChild(item);
    });
  }

  function renderCategoryOptions() {
    if (!customAlertCategoriesContainer) {
      return;
    }

    customAlertCategoriesContainer.innerHTML = '';

    if (!state.rulesReady) {
      const loading = document.createElement('p');
      loading.className = 'notification-category-placeholder';
      loading.textContent = 'ごみの種類を読み込み中です…';
      customAlertCategoriesContainer.appendChild(loading);
      return;
    }

    const fragment = document.createDocumentFragment();

    state.rules.forEach((rule) => {
      const checkboxId = `custom-alert-category-${rule.id}`;
      const label = document.createElement('label');
      label.setAttribute('for', checkboxId);

      const input = document.createElement('input');
      input.type = 'checkbox';
      input.id = checkboxId;
      input.value = rule.id;

      const name = document.createElement('span');
      name.textContent = rule.name;

      label.appendChild(input);
      label.appendChild(name);
      fragment.appendChild(label);
    });

    customAlertCategoriesContainer.appendChild(fragment);
  }

  async function ensurePermission() {
    if (!notificationsSupported) {
      return false;
    }

    if (Notification.permission === 'granted') {
      return true;
    }

    if (Notification.permission === 'denied') {
      updateStatusMessage();
      return false;
    }

    const result = await Notification.requestPermission();
    updateStatusMessage();
    return result === 'granted';
  }

  function cancelScheduledNotifications() {
    state.timeouts.forEach((timeoutId) => clearTimeout(timeoutId));
    state.timeouts = [];
  }

  function computeTriggerDate(collectionDate, timeString) {
    const trigger = new Date(collectionDate);
    trigger.setDate(trigger.getDate() - 1);
    const [hours, minutes] = sanitizeTime(timeString).split(':').map((value) => Number.parseInt(value, 10));
    trigger.setHours(hours, minutes, 0, 0);
    return trigger;
  }

  function scheduleNotification(registration, triggerDate, title, body, tag) {
    const delay = triggerDate.getTime() - Date.now();
    if (delay <= 0 || delay > 2147483647) {
      return;
    }

    const timeoutId = setTimeout(() => {
      registration.showNotification(title, {
        body,
        icon: ICON_PATH,
        badge: ICON_PATH,
        tag,
      });
    }, delay);

    state.timeouts.push(timeoutId);
  }

  function scheduleNotifications() {
    cancelScheduledNotifications();

    if (!notificationsSupported || !state.rulesReady) {
      updateStatusMessage();
      return;
    }

    if (Notification.permission !== 'granted') {
      updateStatusMessage();
      return;
    }

    navigator.serviceWorker.ready
      .then((registration) => {
        const now = new Date();
        now.setSeconds(0, 0);

        const start = new Date(now);
        start.setHours(0, 0, 0, 0);

        for (let offset = 0; offset <= LOOKAHEAD_DAYS; offset += 1) {
          const collectionDate = new Date(start);
          collectionDate.setDate(start.getDate() + offset);
          const events = state.rules.filter((rule) => occursOnDate(rule, collectionDate));

          if (events.length === 0) {
            continue;
          }

          const formattedDate = collectionFormatter.format(collectionDate);
          const dateKey = formatDateKey(collectionDate);

          if (state.settings.defaultEnabled) {
            const triggerDate = computeTriggerDate(collectionDate, DEFAULT_TIME);
            if (triggerDate > now) {
              const eventNames = events.map((event) => event.name).join('・');
              const body = `明日(${formattedDate})は${eventNames}の日です。`;
              scheduleNotification(
                registration,
                triggerDate,
                'ごみ出しリマインダー',
                body,
                `default-${dateKey}`,
              );
            }
          }

          state.settings.customAlerts.forEach((alert) => {
            const relevantEvents = events.filter((event) => alert.categories.includes(event.id));
            if (relevantEvents.length === 0) {
              return;
            }

            const triggerDate = computeTriggerDate(collectionDate, alert.time);
            if (triggerDate <= now) {
              return;
            }

            const eventNames = relevantEvents.map((event) => event.name).join('・');
            const body = `明日(${formattedDate})は${eventNames}の日です。`;
            scheduleNotification(
              registration,
              triggerDate,
              'ごみ出しリマインダー',
              body,
              `custom-${alert.id}-${dateKey}`,
            );
          });
        }
      })
      .catch((error) => {
        console.error('通知のスケジュールに失敗しました。', error);
      })
      .finally(() => {
        updateStatusMessage();
      });
  }

  function handleDefaultToggleChange(event) {
    const nextValue = event.target.checked;

    Promise.resolve()
      .then(() => (nextValue ? ensurePermission() : true))
      .then((permitted) => {
        if (!permitted) {
          event.target.checked = state.settings.defaultEnabled;
          updateStatusMessage();
          return;
        }

        state.settings.defaultEnabled = nextValue;
        saveSettings();
        scheduleNotifications();
      })
      .catch((error) => {
        console.error('通知設定の更新に失敗しました。', error);
        event.target.checked = state.settings.defaultEnabled;
      })
      .finally(() => {
        updateStatusMessage();
      });
  }

  function handleCustomAlertSubmit(event) {
    event.preventDefault();

    if (!notificationsSupported || !customAlertCategoriesContainer) {
      return;
    }

    const formTime = customAlertTimeInput ? sanitizeTime(customAlertTimeInput.value) : DEFAULT_TIME;
    const selectedCategories = Array.from(
      customAlertCategoriesContainer.querySelectorAll("input[type='checkbox']:checked"),
    ).map((input) => input.value);

    if (selectedCategories.length === 0) {
      window.alert('お知らせしたいごみの種類を選択してください。');
      return;
    }

    ensurePermission().then((permitted) => {
      if (!permitted) {
        updateStatusMessage();
        return;
      }

      const alertId = `custom-${Date.now().toString(36)}-${Math.random()
        .toString(36)
        .slice(2, 7)}`;
      state.settings.customAlerts.push({
        id: alertId,
        time: formTime,
        categories: selectedCategories,
      });
      saveSettings();
      renderCustomAlerts();
      scheduleNotifications();
      updateStatusMessage();

      if (customAlertForm) {
        customAlertForm.reset();
      }
      if (customAlertTimeInput) {
        customAlertTimeInput.value = formTime;
      }
    });
  }

  function handleCustomAlertListClick(event) {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }

    const alertId = target.getAttribute('data-remove-alert');
    if (!alertId) {
      return;
    }

    state.settings.customAlerts = state.settings.customAlerts.filter((alert) => alert.id !== alertId);
    saveSettings();
    renderCustomAlerts();
    scheduleNotifications();
    updateStatusMessage();
  }

  function applySettingsToUi() {
    if (defaultAlertToggle) {
      defaultAlertToggle.checked = state.settings.defaultEnabled;
    }
    renderCustomAlerts();
  }

  function init() {
    try {
      state.settings = loadSettings();
    } catch (error) {
      console.error('通知設定の初期化に失敗しました。', error);
    }

    applySettingsToUi();
    updateSupportUi();
    updateStatusMessage();

    if (!notificationsSupported) {
      return;
    }

    if (defaultAlertToggle) {
      defaultAlertToggle.addEventListener('change', handleDefaultToggleChange);
    }

    if (customAlertForm) {
      customAlertForm.addEventListener('submit', handleCustomAlertSubmit);
    }

    if (customAlertListElement) {
      customAlertListElement.addEventListener('click', handleCustomAlertListClick);
    }
  }

  function setScheduleRules(rules) {
    if (!Array.isArray(rules)) {
      return;
    }

    state.rules = [...rules];
    state.ruleMap = new Map(rules.map((rule) => [rule.id, rule]));
    state.rulesReady = state.rules.length > 0;

    const sanitizedAlerts = state.settings.customAlerts
      .map((alert) => ({
        ...alert,
        categories: alert.categories.filter((id) => state.ruleMap.has(id)),
      }))
      .filter((alert) => alert.categories.length > 0);

    if (sanitizedAlerts.length !== state.settings.customAlerts.length) {
      state.settings.customAlerts = sanitizedAlerts;
      saveSettings();
    }

    renderCategoryOptions();
    renderCustomAlerts();
    scheduleNotifications();
    updateStatusMessage();
  }

  return { init, setScheduleRules };
})();

NotificationManager.init();

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

    NotificationManager.setScheduleRules(scheduleRules);

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
