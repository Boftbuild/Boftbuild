const SPREADSHEET_ID = '1h1nbpHr41yyD38OjQXzNGC3a3kUVd4SzyyssnIKWwMw';
const APP_SECRET = 'CHANGE_ME_TO_A_LONG_RANDOM_SECRET';

const SHEETS = {
  sessions: 'Sessions',
  settings: 'Settings',
};

const SESSION_HEADERS = [
  'id',
  'project',
  'module',
  'category',
  'note',
  'startTime',
  'endTime',
  'durationMinutes',
  'durationHours',
  'hourlyRate',
  'internalValue',
  'status',
  'whatWasDone',
  'whatChanged',
  'filesAffected',
  'problemsFound',
  'solutionOrNextStep',
  'result',
  'impact',
  'knowledgeGained',
  'nextAction',
  'createdAt',
  'updatedAt',
];

function doGet(e) {
  return handleRequest(e.parameter || {});
}

function doPost(e) {
  const body = e.postData && e.postData.contents ? JSON.parse(e.postData.contents) : {};
  return handleRequest(body);
}

function handleRequest(payload) {
  try {
    assertAuthorized(payload.secret);
    setupSheets();

    const action = payload.action || 'listSessions';
    if (action === 'setup') return json({ ok: true, data: setupSheets() });
    if (action === 'listSessions') return json({ ok: true, data: listSessions() });
    if (action === 'createSession') return json({ ok: true, data: createSession(payload.session) });
    if (action === 'endSession') return json({ ok: true, data: endSession(payload.id, payload.report, payload.endTime) });
    if (action === 'getSettings') return json({ ok: true, data: getSettings() });
    if (action === 'updateSettings') return json({ ok: true, data: updateSettings(payload.settings) });

    return json({ ok: false, error: 'Unknown action: ' + action });
  } catch (err) {
    return json({ ok: false, error: err.message });
  }
}

function assertAuthorized(secret) {
  if (!APP_SECRET || APP_SECRET === 'CHANGE_ME_TO_A_LONG_RANDOM_SECRET') {
    throw new Error('APP_SECRET is not configured in Apps Script.');
  }
  if (secret !== APP_SECRET) {
    throw new Error('Unauthorized founder time request.');
  }
}

function setupSheets() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sessions = getOrCreateSheet_(ss, SHEETS.sessions);
  const settings = getOrCreateSheet_(ss, SHEETS.settings);

  writeHeaders_(sessions, SESSION_HEADERS);
  writeHeaders_(settings, ['key', 'value', 'updatedAt']);

  if (settings.getLastRow() < 2) {
    settings.appendRow(['hourlyRate', 75, new Date().toISOString()]);
  }

  sessions.setFrozenRows(1);
  settings.setFrozenRows(1);
  sessions.autoResizeColumns(1, SESSION_HEADERS.length);
  settings.autoResizeColumns(1, 3);

  return {
    sessionsSheet: SHEETS.sessions,
    settingsSheet: SHEETS.settings,
  };
}

function listSessions() {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEETS.sessions);
  const values = sheet.getDataRange().getValues();
  if (values.length <= 1) return [];

  const headers = values[0];
  return values.slice(1).filter(row => row[0]).map(rowToSession_(headers));
}

function createSession(session) {
  if (!session) throw new Error('Missing session payload.');

  const now = new Date().toISOString();
  const record = {
    id: session.id || Utilities.getUuid(),
    project: session.project || 'BOFT System',
    module: session.module || 'Web App',
    category: session.category || 'Development',
    note: session.note || '',
    startTime: session.startTime || now,
    endTime: '',
    durationMinutes: '',
    durationHours: '',
    hourlyRate: Number(session.hourlyRate || getSettings().hourlyRate || 75),
    internalValue: '',
    status: 'active',
    whatWasDone: '',
    whatChanged: '',
    filesAffected: '',
    problemsFound: '',
    solutionOrNextStep: '',
    result: '',
    impact: '',
    knowledgeGained: '',
    nextAction: '',
    createdAt: now,
    updatedAt: now,
  };

  SpreadsheetApp.openById(SPREADSHEET_ID)
    .getSheetByName(SHEETS.sessions)
    .appendRow(SESSION_HEADERS.map(header => record[header]));

  return record;
}

function endSession(id, report, providedEndTime) {
  if (!id) throw new Error('Missing session id.');
  if (!report) throw new Error('Missing final report.');

  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEETS.sessions);
  const values = sheet.getDataRange().getValues();
  const headers = values[0];
  const idIndex = headers.indexOf('id');
  const rowIndex = values.findIndex((row, index) => index > 0 && row[idIndex] === id);
  if (rowIndex < 1) throw new Error('Session not found.');

  const current = rowToSession_(headers)(values[rowIndex]);
  const endTime = providedEndTime || new Date().toISOString();
  const durationMinutes = Math.max(0, Math.round((new Date(endTime).getTime() - new Date(current.startTime).getTime()) / 60000));
  const durationHours = Number((durationMinutes / 60).toFixed(2));
  const hourlyRate = Number(current.hourlyRate || getSettings().hourlyRate || 75);
  const internalValue = Number((durationHours * hourlyRate).toFixed(2));

  const updated = Object.assign({}, current, {
    endTime,
    durationMinutes,
    durationHours,
    hourlyRate,
    internalValue,
    status: 'completed',
    whatWasDone: report.whatWasDone || '',
    whatChanged: report.whatChanged || '',
    filesAffected: report.filesAffected || '',
    problemsFound: report.problemsFound || '',
    solutionOrNextStep: report.solutionOrNextStep || '',
    result: report.result || '',
    impact: report.impact || '',
    knowledgeGained: report.knowledgeGained || '',
    nextAction: report.nextAction || '',
    updatedAt: new Date().toISOString(),
  });

  sheet.getRange(rowIndex + 1, 1, 1, SESSION_HEADERS.length).setValues([
    SESSION_HEADERS.map(header => updated[header]),
  ]);

  return updated;
}

function getSettings() {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEETS.settings);
  const values = sheet.getDataRange().getValues();
  const settings = { hourlyRate: 75 };

  values.slice(1).forEach(row => {
    if (row[0]) settings[row[0]] = normalizeValue_(row[1]);
  });

  return settings;
}

function updateSettings(settings) {
  if (!settings) throw new Error('Missing settings payload.');

  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEETS.settings);
  const values = sheet.getDataRange().getValues();
  const existingKeys = values.map(row => row[0]);
  const now = new Date().toISOString();

  Object.keys(settings).forEach(key => {
    const rowIndex = existingKeys.indexOf(key);
    if (rowIndex > 0) {
      sheet.getRange(rowIndex + 1, 2, 1, 2).setValues([[settings[key], now]]);
    } else {
      sheet.appendRow([key, settings[key], now]);
    }
  });

  return getSettings();
}

function rowToSession_(headers) {
  return function(row) {
    const record = {};
    headers.forEach((header, index) => {
      record[header] = normalizeValue_(row[index]);
    });

    record.report = {
      whatWasDone: record.whatWasDone || '',
      whatChanged: record.whatChanged || '',
      filesAffected: record.filesAffected || '',
      problemsFound: record.problemsFound || '',
      solutionOrNextStep: record.solutionOrNextStep || '',
      result: record.result || '',
      impact: record.impact || '',
      knowledgeGained: record.knowledgeGained || '',
      nextAction: record.nextAction || '',
    };

    return record;
  };
}

function normalizeValue_(value) {
  if (value instanceof Date) return value.toISOString();
  return value;
}

function writeHeaders_(sheet, headers) {
  const firstRow = sheet.getRange(1, 1, 1, headers.length).getValues()[0];
  const hasHeaders = firstRow.some(Boolean);
  if (!hasHeaders) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
  }
}

function getOrCreateSheet_(ss, name) {
  return ss.getSheetByName(name) || ss.insertSheet(name);
}

function json(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
