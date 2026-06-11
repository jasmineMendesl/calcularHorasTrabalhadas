const HOUR_VALUE = 60;
const GOAL_HOURS = 176;
const STORAGE_KEY = 'hourCounterEntries';
const SPREADSHEET_API_URL = 'https://script.google.com/macros/s/AKfycbxvnESpg2ImihYg3TNDM03vYmcGQV50tNqeK9FHJ297KYlCXNMc_pYgl7dh_eGzM-Mp/exec';

const form = document.querySelector('#hours-form');
const personInput = document.querySelector('#person-input');
const hoursInput = document.querySelector('#hours-input');
const descriptionInput = document.querySelector('#description-input');
const jiraInput = document.querySelector('#jira-input');
const workedHours = document.querySelector('#worked-hours');
const earnedValue = document.querySelector('#earned-value');
const jasmineTotal = document.querySelector('#jasmine-total');
const jasmineValue = document.querySelector('#jasmine-value');
const pedroTotal = document.querySelector('#pedro-total');
const pedroValue = document.querySelector('#pedro-value');
const remainingHours = document.querySelector('#remaining-hours');
const remainingValue = document.querySelector('#remaining-value');
const paceRemainingHours = document.querySelector('#pace-remaining-hours');
const pacePeriod = document.querySelector('#pace-period');
const businessDayHours = document.querySelector('#business-day-hours');
const businessDaysCount = document.querySelector('#business-days-count');
const calendarDayHours = document.querySelector('#calendar-day-hours');
const calendarDaysCount = document.querySelector('#calendar-days-count');
const dailyGoalHours = document.querySelector('#daily-goal-hours');
const dailyWorkedHours = document.querySelector('#daily-worked-hours');
const dailyRemainingHours = document.querySelector('#daily-remaining-hours');
const dailyStatusMessage = document.querySelector('#daily-status-message');
const dailyProgressTrack = document.querySelector('.daily-progress-track');
const dailyProgressFill = document.querySelector('#daily-progress-fill');
const progressPercent = document.querySelector('#progress-percent');
const progressFill = document.querySelector('#progress-fill');
const statusMessage = document.querySelector('#status-message');
const historyList = document.querySelector('#history-list');
const clearButton = document.querySelector('#clear-button');
const storageStatus = document.querySelector('#storage-status');
const syncStatus = document.querySelector('#sync-status');

let entries = [];
let isSyncing = false;

const inputError = document.createElement('p');
inputError.className = 'input-error';
inputError.setAttribute('role', 'alert');
form.appendChild(inputError);

function hasSpreadsheetApi() {
  return SPREADSHEET_API_URL.trim().length > 0;
}

function createEntryId() {
  if (crypto.randomUUID) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function normalizeEntry(entry) {
  const jiraLink = entry.jiraLink === 'Sem link.' ? '' : entry.jiraLink || '';

  return {
    id: entry.id || createEntryId(),
    hours: Number(entry.hours),
    date: entry.date || '',
    person: entry.person || '',
    description: entry.description || '',
    jiraLink
  };
}

function normalizeEntries(rawEntries) {
  if (!Array.isArray(rawEntries)) {
    return [];
  }

  return rawEntries
    .map(normalizeEntry)
    .filter((entry) => Number.isFinite(entry.hours) && entry.hours > 0);
}

function loadLocalEntries() {
  const savedEntries = localStorage.getItem(STORAGE_KEY);

  if (!savedEntries) {
    return [];
  }

  try {
    const parsedEntries = JSON.parse(savedEntries);
    return normalizeEntries(parsedEntries);
  } catch {
    return [];
  }
}

function saveLocalEntries() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

function setSyncMessage(message, isError = false) {
  syncStatus.textContent = message;
  syncStatus.style.color = isError ? 'var(--danger)' : 'var(--primary)';
}

function setSyncing(value) {
  isSyncing = value;
  form.querySelector('button').disabled = value;
  clearButton.disabled = value;
}

async function requestSpreadsheet(action, payload = {}) {
  return requestSpreadsheetJsonp(action, payload);
}

function requestSpreadsheetJsonp(action, payload = {}) {
  return new Promise((resolve, reject) => {
    const callbackName = `handleSpreadsheetResponse_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    const script = document.createElement('script');
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error('A planilha demorou para responder.'));
    }, 15000);

    const params = new URLSearchParams({
      action,
      callback: callbackName,
      payload: JSON.stringify(payload)
    });

    function cleanup() {
      clearTimeout(timeout);
      delete window[callbackName];
      script.remove();
    }

    window[callbackName] = (data) => {
      cleanup();

      if (!data.ok) {
        reject(new Error(data.error || 'Nao foi possivel sincronizar com a planilha.'));
        return;
      }

      resolve(data);
    };

    script.addEventListener('error', () => {
      cleanup();
      reject(new Error('Nao foi possivel acessar a planilha.'));
    });

    script.src = `${SPREADSHEET_API_URL}?${params.toString()}`;
    document.body.appendChild(script);
  });
}

async function loadEntries() {
  entries = loadLocalEntries();

  if (!hasSpreadsheetApi()) {
    storageStatus.textContent = 'Seu progresso fica salvo neste navegador.';
    setSyncMessage('Configure a URL da planilha em SPREADSHEET_API_URL para usar como banco de dados.');
    render();
    return;
  }

  storageStatus.textContent = 'Usando a planilha como banco de dados.';
  setSyncing(true);
  setSyncMessage('Sincronizando com a planilha...');
  render();

  try {
    const data = await requestSpreadsheet('list');
    entries = normalizeEntries(data.entries);
    saveLocalEntries();
    setSyncMessage('Dados carregados da planilha.');
  } catch (error) {
    setSyncMessage(`${error.message} Usando os dados salvos neste navegador.`, true);
  } finally {
    setSyncing(false);
    render();
  }
}

async function persistEntry(entry) {
  if (!hasSpreadsheetApi()) {
    saveLocalEntries();
    return;
  }

  const spreadsheetEntry = {
    ...entry,
    description: entry.description || 'Sem descricao.',
    jiraLink: entry.jiraLink || 'Sem link.'
  };

  await requestSpreadsheet('add', { entry: spreadsheetEntry });
  saveLocalEntries();
  setSyncMessage('Lancamento salvo na planilha.');
}

async function removeEntry(entry) {
  if (!hasSpreadsheetApi()) {
    entries = entries.filter((currentEntry) => currentEntry.id !== entry.id);
    saveLocalEntries();
    render();
    return;
  }

  setSyncing(true);

  try {
    await requestSpreadsheet('delete', { id: entry.id });
    entries = entries.filter((currentEntry) => currentEntry.id !== entry.id);
    saveLocalEntries();
    setSyncMessage('Lancamento removido da planilha.');
  } catch (error) {
    setSyncMessage(error.message, true);
  } finally {
    setSyncing(false);
    render();
  }
}

async function clearEntries() {
  if (!hasSpreadsheetApi()) {
    entries = [];
    saveLocalEntries();
    render();
    return;
  }

  setSyncing(true);

  try {
    await requestSpreadsheet('clear');
    entries = [];
    saveLocalEntries();
    setSyncMessage('Planilha zerada.');
  } catch (error) {
    setSyncMessage(error.message, true);
  } finally {
    setSyncing(false);
    render();
  }
}

function formatHours(hours) {
  const totalMinutes = Math.round(hours * 60);
  const wholeHours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (minutes === 0) {
    return `${wholeHours}h`;
  }

  if (wholeHours === 0) {
    return `${minutes}m`;
  }

  return `${wholeHours}h ${minutes}m`;
}

function formatCurrency(value) {
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  });
}

function getTotalHours() {
  return entries.reduce((total, entry) => total + entry.hours, 0);
}

function getTotalHoursByPerson(person) {
  return entries.reduce((total, entry) => {
    if (entry.person !== person) {
      return total;
    }

    return total + entry.hours;
  }, 0);
}

function getDateKey(date = new Date()) {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();

  return `${day}/${month}/${year}`;
}

function getHoursForDate(date = new Date()) {
  const dateKey = getDateKey(date);

  return entries.reduce((total, entry) => {
    if (!String(entry.date).startsWith(dateKey)) {
      return total;
    }

    return total + entry.hours;
  }, 0);
}

function getRemainingDaysInMonth(date = new Date()) {
  const year = date.getFullYear();
  const month = date.getMonth();
  const lastDay = new Date(year, month + 1, 0).getDate();
  let businessDays = 0;

  for (let day = date.getDate(); day <= lastDay; day += 1) {
    const dayOfWeek = new Date(year, month, day).getDay();

    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      businessDays += 1;
    }
  }

  return {
    businessDays,
    calendarDays: lastDay - date.getDate() + 1,
    lastDay: new Date(year, month, lastDay)
  };
}

function formatDailyHours(hours) {
  if (!Number.isFinite(hours) || hours <= 0) {
    return '0h';
  }

  return formatHours(hours);
}

function formatDayCount(count, singular, plural) {
  return `${count} ${count === 1 ? singular : plural} restantes`;
}

function parseHours(value) {
  const normalizedValue = value
    .trim()
    .toLowerCase()
    .replace(',', '.')
    .replace(/\s+/g, ' ');

  if (!normalizedValue) {
    return null;
  }

  const clockMatch = normalizedValue.match(/^(\d+):([0-5]?\d)$/);

  if (clockMatch) {
    return Number(clockMatch[1]) + Number(clockMatch[2]) / 60;
  }

  const hoursMatch = normalizedValue.match(/(\d+(?:\.\d+)?)\s*h/);
  const minutesMatch = normalizedValue.match(/(\d+)\s*m/);

  if (hoursMatch || minutesMatch) {
    const hours = hoursMatch ? Number(hoursMatch[1]) : 0;
    const minutes = minutesMatch ? Number(minutesMatch[1]) : 0;
    return hours + minutes / 60;
  }

  const decimalHours = Number(normalizedValue);
  return Number.isFinite(decimalHours) ? decimalHours : null;
}

function renderHistory() {
  historyList.innerHTML = '';

  if (entries.length === 0) {
    const emptyItem = document.createElement('tr');
    const emptyCell = document.createElement('td');

    emptyCell.colSpan = 6;
    emptyItem.className = 'empty-history';
    emptyCell.textContent = 'Nenhuma hora adicionada ainda.';
    emptyItem.appendChild(emptyCell);
    historyList.appendChild(emptyItem);
    return;
  }

  entries.slice().reverse().forEach((entry, index) => {
    const row = document.createElement('tr');
    const originalIndex = entries.length - 1 - index;
    const originalEntry = entries[originalIndex];
    const dateCell = document.createElement('td');
    const personCell = document.createElement('td');
    const hoursCell = document.createElement('td');
    const valueCell = document.createElement('td');
    const detailsCell = document.createElement('td');
    const actionCell = document.createElement('td');
    const details = document.createElement('div');
    const description = document.createElement('span');
    const removeButton = document.createElement('button');

    dateCell.textContent = entry.date;
    personCell.textContent = entry.person || '-';
    hoursCell.textContent = formatHours(entry.hours);
    valueCell.textContent = formatCurrency(entry.hours * HOUR_VALUE);
    details.className = 'history-details';
    description.className = 'history-description';
    description.textContent = entry.description || 'Sem descricao.';
    removeButton.className = 'remove-entry';
    removeButton.type = 'button';
    removeButton.textContent = 'Remover';

    removeButton.addEventListener('click', () => {
      removeEntry(originalEntry);
    });

    details.appendChild(description);

    if (entry.jiraLink) {
      const jiraLink = document.createElement('a');
      jiraLink.className = 'history-link';
      jiraLink.href = entry.jiraLink;
      jiraLink.target = '_blank';
      jiraLink.rel = 'noopener noreferrer';
      jiraLink.textContent = 'Abrir task do Jira';
      details.appendChild(jiraLink);
    }

    detailsCell.appendChild(details);
    actionCell.appendChild(removeButton);
    row.append(dateCell, personCell, hoursCell, valueCell, detailsCell, actionCell);
    historyList.appendChild(row);
  });
}

function render() {
  const today = new Date();
  const totalHours = getTotalHours();
  const todayHours = getHoursForDate(today);
  const jasmineHours = getTotalHoursByPerson('Jasmine');
  const pedroHours = getTotalHoursByPerson('Pedro');
  const totalEarned = totalHours * HOUR_VALUE;
  const missingHours = Math.max(GOAL_HOURS - totalHours, 0);
  const missingValue = missingHours * HOUR_VALUE;
  const percent = Math.min((totalHours / GOAL_HOURS) * 100, 100);
  const remainingDays = getRemainingDaysInMonth(today);
  const hoursPerBusinessDay = remainingDays.businessDays > 0
    ? missingHours / remainingDays.businessDays
    : 0;
  const hoursPerCalendarDay = remainingDays.calendarDays > 0
    ? missingHours / remainingDays.calendarDays
    : 0;
  const isBusinessDay = today.getDay() !== 0 && today.getDay() !== 6;
  const missingHoursAtStartOfDay = Math.max(
    GOAL_HOURS - (totalHours - todayHours),
    0
  );
  const dailyGoal = isBusinessDay && remainingDays.businessDays > 0
    ? missingHoursAtStartOfDay / remainingDays.businessDays
    : 0;
  const dailyMissing = Math.max(dailyGoal - todayHours, 0);
  const dailyPercent = dailyGoal > 0
    ? Math.min((todayHours / dailyGoal) * 100, 100)
    : 0;

  workedHours.textContent = formatHours(totalHours);
  earnedValue.textContent = formatCurrency(totalEarned);
  jasmineTotal.textContent = formatHours(jasmineHours);
  jasmineValue.textContent = formatCurrency(jasmineHours * HOUR_VALUE);
  pedroTotal.textContent = formatHours(pedroHours);
  pedroValue.textContent = formatCurrency(pedroHours * HOUR_VALUE);
  remainingHours.textContent = formatHours(missingHours);
  remainingValue.textContent = formatCurrency(missingValue);
  paceRemainingHours.textContent = formatHours(missingHours);
  pacePeriod.textContent = `Ate ${remainingDays.lastDay.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long'
  })}`;
  businessDayHours.textContent = formatDailyHours(hoursPerBusinessDay);
  businessDaysCount.textContent = formatDayCount(
    remainingDays.businessDays,
    'dia util',
    'dias uteis'
  );
  calendarDayHours.textContent = formatDailyHours(hoursPerCalendarDay);
  calendarDaysCount.textContent = formatDayCount(
    remainingDays.calendarDays,
    'dia corrido',
    'dias corridos'
  );
  dailyGoalHours.textContent = formatHours(dailyGoal);
  dailyWorkedHours.textContent = formatHours(todayHours);
  dailyRemainingHours.textContent = formatHours(dailyMissing);
  dailyProgressFill.style.width = `${dailyPercent}%`;
  dailyProgressTrack.setAttribute('aria-valuenow', String(Math.round(dailyPercent)));
  progressPercent.textContent = `${Math.round(percent)}%`;
  progressFill.style.width = `${percent}%`;

  if (!isBusinessDay) {
    dailyStatusMessage.textContent = todayHours > 0
      ? `${formatHours(todayHours)} registradas hoje, fora dos dias uteis.`
      : 'Hoje nao e dia util, entao nao ha meta diaria.';
  } else if (dailyGoal === 0) {
    dailyStatusMessage.textContent = 'A meta mensal ja foi concluida.';
  } else if (dailyMissing === 0) {
    dailyStatusMessage.textContent = 'Meta do dia concluida.';
  } else {
    dailyStatusMessage.textContent = `Faltam ${formatHours(dailyMissing)} para concluir a meta de hoje.`;
  }

  if (totalHours >= GOAL_HOURS) {
    statusMessage.textContent = 'Meta batida. Tudo que entrar agora e acima da meta.';
  } else if (totalHours > 0) {
    statusMessage.textContent = `Faltam ${formatHours(missingHours)} para fechar ${formatCurrency(GOAL_HOURS * HOUR_VALUE)}.`;
  } else {
    statusMessage.textContent = 'Voce ainda nao adicionou horas.';
  }

  renderHistory();
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();

  if (isSyncing) {
    return;
  }

  const hours = parseHours(hoursInput.value);
  const person = personInput.value;
  const description = descriptionInput.value.trim();
  const jiraLink = jiraInput.value.trim();

  if (!person) {
    inputError.textContent = 'Selecione Jasmine ou Pedro.';
    personInput.focus();
    return;
  }

  if (!Number.isFinite(hours) || hours <= 0) {
    inputError.textContent = 'Digite um valor como 1h 35m, 1:35, 95m ou 1,5.';
    hoursInput.focus();
    return;
  }

  inputError.textContent = '';

  const entry = {
    id: createEntryId(),
    hours,
    person,
    description,
    jiraLink,
    date: new Date().toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  };

  entries.push(entry);
  render();

  try {
    setSyncing(true);
    await persistEntry(entry);
    form.reset();
    hoursInput.focus();
  } catch (error) {
    entries = entries.filter((currentEntry) => currentEntry.id !== entry.id);
    setSyncMessage(error.message, true);
  } finally {
    setSyncing(false);
    render();
  }
});

clearButton.addEventListener('click', async () => {
  const shouldClear = confirm('Quer zerar todos os lancamentos?');

  if (!shouldClear) {
    return;
  }

  await clearEntries();
});

loadEntries();
