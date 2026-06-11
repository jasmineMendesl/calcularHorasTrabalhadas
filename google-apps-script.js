const SPREADSHEET_ID = '10ysQma1QLVAmQqQO7qVkwCS4tuXDK3KEWTR-0HtxN-U';
const SHEET_NAME = 'Horas admooh';
const HEADERS = ['id', 'date', 'hours', 'person', 'description', 'jiraLink'];

function doGet(event) {
  const callback = event.parameter.callback || 'callback';
  const payload = parsePayload(event.parameter.action, event.parameter.payload);
  const data = handleRequest(payload);

  return javascriptResponse(callback, data);
}

function doPost(event) {
  const payload = JSON.parse(event.postData.contents || '{}');
  const data = handleRequest(payload);

  return jsonResponse(data);
}

function testConnection() {
  const sheet = getSheet();
  sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);

  return `Conexao OK com a aba "${SHEET_NAME}".`;
}

function parsePayload(action, payloadText) {
  try {
    return {
      action,
      ...(JSON.parse(payloadText || '{}'))
    };
  } catch (error) {
    return { action };
  }
}

function handleRequest(payload) {
  try {
    const sheet = getSheet();

    if (payload.action === 'list') {
      return {
        ok: true,
        entries: getEntries(sheet)
      };
    }

    if (payload.action === 'add') {
      const entry = payload.entry || {};

      if (!entry.id || !entry.date || !Number(entry.hours) || !entry.person) {
        throw new Error('Lancamento invalido.');
      }

      sheet.appendRow([
        entry.id,
        entry.date,
        Number(entry.hours),
        entry.person || '',
        entry.description || '',
        entry.jiraLink || ''
      ]);

      return {
        ok: true,
        entries: getEntries(sheet)
      };
    }

    if (payload.action === 'delete') {
      deleteEntry(sheet, payload.id);

      return {
        ok: true,
        entries: getEntries(sheet)
      };
    }

    if (payload.action === 'clear') {
      clearEntries(sheet);

      return {
        ok: true,
        entries: []
      };
    }

    throw new Error('Acao desconhecida.');
  } catch (error) {
    return {
      ok: false,
      error: error.message
    };
  }
}

function getSheet() {
  const spreadsheet = getSpreadsheet();
  let sheet = spreadsheet.getSheetByName(SHEET_NAME);

  if (!sheet) {
    sheet = spreadsheet.insertSheet(SHEET_NAME);
  }

  ensureHeaders(sheet);

  return sheet;
}

function getSpreadsheet() {
  if (SPREADSHEET_ID) {
    return SpreadsheetApp.openById(SPREADSHEET_ID);
  }

  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();

  if (!spreadsheet) {
    throw new Error('Planilha nao encontrada. Preencha SPREADSHEET_ID no Apps Script.');
  }

  return spreadsheet;
}

function ensureHeaders(sheet) {
  const firstRow = sheet.getRange(1, 1, 1, HEADERS.length).getValues()[0];
  const hasHeaders = HEADERS.every((header, index) => firstRow[index] === header);

  if (!hasHeaders) {
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
  }
}

function getEntries(sheet) {
  const lastRow = sheet.getLastRow();

  if (lastRow < 2) {
    return [];
  }

  return sheet
    .getRange(2, 1, lastRow - 1, HEADERS.length)
    .getValues()
    .filter((row) => row[0] && Number(row[2]) > 0)
    .map((row) => ({
      id: String(row[0]),
      date: String(row[1]),
      hours: Number(row[2]),
      person: String(row[3] || ''),
      description: String(row[4] || ''),
      jiraLink: String(row[5] || '')
    }));
}

function deleteEntry(sheet, id) {
  if (!id) {
    throw new Error('ID nao informado.');
  }

  const values = sheet.getRange(1, 1, sheet.getLastRow(), 1).getValues();
  const rowIndex = values.findIndex((row) => String(row[0]) === String(id));

  if (rowIndex > 0) {
    sheet.deleteRow(rowIndex + 1);
  }
}

function clearEntries(sheet) {
  const lastRow = sheet.getLastRow();

  if (lastRow > 1) {
    sheet.deleteRows(2, lastRow - 1);
  }
}

function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function javascriptResponse(callback, data) {
  const safeCallback = String(callback).replace(/[^\w.$]/g, '');

  return ContentService
    .createTextOutput(`${safeCallback}(${JSON.stringify(data)});`)
    .setMimeType(ContentService.MimeType.JAVASCRIPT);
}
