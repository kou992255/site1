export const sourceReference = 'https://www.city.hirakata.osaka.jp/';

export const collectionAreas = {
  name: '枚方市 養父西町',
  note:
    '枚方市が公表している2024年度 資源・ごみ収集カレンダー（養父西町）を基に再構成しています。内容はアプリ内でも確認できます。',
};

export const weekdayNames = ['日', '月', '火', '水', '木', '金', '土'];

const CSV_PATH = 'data/schedule.csv';

function parseCsv(text) {
  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/^\ufeff/, '');
  const rows = [];
  let currentRow = [];
  let currentField = '';
  let inQuotes = false;

  for (let i = 0; i < normalized.length; i += 1) {
    const char = normalized[i];

    if (inQuotes) {
      if (char === '"') {
        const nextChar = normalized[i + 1];
        if (nextChar === '"') {
          currentField += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        currentField += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      continue;
    }

    if (char === ',') {
      currentRow.push(currentField);
      currentField = '';
      continue;
    }

    if (char === '\n') {
      currentRow.push(currentField);
      rows.push(currentRow);
      currentRow = [];
      currentField = '';
      continue;
    }

    currentField += char;
  }

  if (inQuotes) {
    throw new Error('CSV parsing error: unmatched quote detected.');
  }

  if (currentField !== '' || currentRow.length > 0) {
    currentRow.push(currentField);
    rows.push(currentRow);
  }

  return rows.filter((row) => row.some((cell) => cell.trim() !== ''));
}

function createRecords(rows) {
  if (rows.length === 0) {
    return [];
  }

  const headers = rows[0].map((header) => header.trim());
  return rows.slice(1).map((cells, index) => {
    const record = { rowNumber: index + 2 };
    headers.forEach((header, headerIndex) => {
      record[header] = (cells[headerIndex] ?? '').trim();
    });
    return record;
  });
}

function parseNumberList(value) {
  if (!value) {
    return [];
  }

  return value
    .split(/[;|,]/)
    .map((part) => part.trim())
    .filter((part) => part !== '')
    .map((part) => Number.parseInt(part, 10))
    .filter((num) => Number.isFinite(num));
}

function mapRecordToRule(record) {
  const rowInfo = `CSV ${record.rowNumber}行目`;
  const baseRule = {
    id: record.id,
    name: record.name,
    type: record.type,
    color: record.color,
    description: record.description,
  };

  if (!baseRule.id) {
    throw new Error(`${rowInfo}: "id" が指定されていません。`);
  }

  if (!baseRule.name) {
    throw new Error(`${rowInfo}: "name" が指定されていません。`);
  }

  if (!baseRule.type) {
    throw new Error(`${rowInfo}: "type" が指定されていません。`);
  }

  if (baseRule.type === 'weekly') {
    const weekdays = parseNumberList(record.weekdays);
    if (weekdays.length === 0) {
      throw new Error(`${rowInfo}: "weekdays" の指定が必要です。`);
    }
    return {
      ...baseRule,
      weekdays,
    };
  }

  if (baseRule.type === 'monthly') {
    const weekday = Number.parseInt(record.weekday, 10);
    const ordinals = parseNumberList(record.ordinals);

    if (!Number.isFinite(weekday)) {
      throw new Error(`${rowInfo}: "weekday" の指定が必要です。`);
    }

    if (ordinals.length === 0) {
      throw new Error(`${rowInfo}: "ordinals" の指定が必要です。`);
    }

    return {
      ...baseRule,
      weekday,
      ordinals,
    };
  }

  throw new Error(`${rowInfo}: 未対応の "type" が指定されました (${baseRule.type})。`);
}

export async function loadScheduleRules() {
  const response = await fetch(CSV_PATH);

  if (!response.ok) {
    throw new Error(`CSVファイルの読み込みに失敗しました: ${response.status}`);
  }

  const csvText = await response.text();
  const rows = parseCsv(csvText);
  const records = createRecords(rows).filter(
    (record) => record.id && !record.id.startsWith('#'),
  );
  return records.map((record) => mapRecordToRule(record));
}
