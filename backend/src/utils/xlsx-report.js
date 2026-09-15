const ExcelJS = require('exceljs');

const BRAND_COLOR = 'FF0B4F6C'; // matches the app's brand-700 teal-blue
const HEADER_FILL = 'FFEAF2F3';
const IST_OFFSET_MINUTES = 5 * 60 + 30; // UTC+5:30, no DST

/** Formats a UTC timestamp (or null) as "DD Mon YYYY, HH:MM" in IST. */
function toIst(value) {
  if (!value) return '';
  const utc = new Date(value);
  if (Number.isNaN(utc.getTime())) return '';
  const ist = new Date(utc.getTime() + IST_OFFSET_MINUTES * 60000);
  const day = String(ist.getUTCDate()).padStart(2, '0');
  const month = ist.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' });
  const year = ist.getUTCFullYear();
  const hours = String(ist.getUTCHours()).padStart(2, '0');
  const mins = String(ist.getUTCMinutes()).padStart(2, '0');
  return `${day} ${month} ${year}, ${hours}:${mins} IST`;
}

const VERDICT_LABEL = { pass: 'Pass', bad_technique: 'Bad Technique', fail: 'Fail' };
function titleCase(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1).replace(/_/g, ' ');
}

const COLUMNS = [
  { key: 'mode', label: 'Mode', width: 15, fmt: titleCase },
  { key: 'trial_no', label: 'Trial #', width: 10 },
  { key: 'status', label: 'Status', width: 13, fmt: titleCase },
  { key: 'started_at', label: 'Started', width: 22, fmt: toIst },
  { key: 'completed_at', label: 'Completed', width: 22, fmt: toIst },
  { key: 'steps_passed', label: 'Steps Passed', width: 14 },
  { key: 'steps_total', label: 'Steps Total', width: 13 },
  { key: 'laryngoscope_lift_force', label: 'Lift Force (psi)', width: 17 },
  { key: 'time_to_place_ett', label: 'Time to Place ETT (s)', width: 20 },
  { key: 'ett_location_cm', label: 'ETT Location (cm)', width: 18 },
  { key: 'total_time_to_intubate', label: 'Total Time (s)', width: 15 },
  { key: 'smart_score', label: 'SMArT Score', width: 13 },
  { key: 'ai_suggestion', label: 'AI Suggestion', width: 16, fmt: (v) => VERDICT_LABEL[v] || '' },
  { key: 'trainer_final_verdict', label: "Trainer's Verdict", width: 16, fmt: (v) => VERDICT_LABEL[v] || '' },
];

/**
 * Builds a formatted training-records report as an .xlsx buffer: a title
 * block, a bold shaded header row, borders, sensible column widths so
 * nothing gets clipped in Excel, and timestamps converted to IST.
 */
async function buildRecordsReport({ subjectName, subjectEmail, generatedFor, rows }) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'SMArT Airway Training';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet('Records', {
    views: [{ state: 'frozen', ySplit: 5 }], // freeze title + header block
    pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1 },
  });

  const lastCol = COLUMNS.length;

  // --- Title block ---
  sheet.mergeCells(1, 1, 1, lastCol);
  const titleCell = sheet.getCell(1, 1);
  titleCell.value = 'SMArT Airway Training — Session Records';
  titleCell.font = { size: 15, bold: true, color: { argb: BRAND_COLOR } };
  sheet.getRow(1).height = 26;

  sheet.mergeCells(2, 1, 2, lastCol);
  const subjectCell = sheet.getCell(2, 1);
  subjectCell.value = subjectEmail ? `${subjectName}  ·  ${subjectEmail}` : subjectName;
  subjectCell.font = { size: 11, color: { argb: 'FF334155' } };

  sheet.mergeCells(3, 1, 3, lastCol);
  const metaCell = sheet.getCell(3, 1);
  metaCell.value = `Generated ${toIst(new Date())}${generatedFor ? `  ·  ${generatedFor}` : ''}`;
  metaCell.font = { size: 9.5, italic: true, color: { argb: 'FF94A3B8' } };

  // spacer row
  sheet.getRow(4).height = 6;

  // --- Header row ---
  const headerRowIdx = 5;
  COLUMNS.forEach((col, i) => {
    const cell = sheet.getCell(headerRowIdx, i + 1);
    cell.value = col.label;
    cell.font = { bold: true, size: 10.5, color: { argb: BRAND_COLOR } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_FILL } };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = { bottom: { style: 'medium', color: { argb: BRAND_COLOR } } };
    sheet.getColumn(i + 1).width = col.width;
  });
  sheet.getRow(headerRowIdx).height = 24;

  // --- Data rows ---
  rows.forEach((row, r) => {
    const rowIdx = headerRowIdx + 1 + r;
    COLUMNS.forEach((col, i) => {
      const raw = row[col.key];
      const cell = sheet.getCell(rowIdx, i + 1);
      cell.value = col.fmt ? col.fmt(raw) : raw ?? '—';
      cell.font = { size: 10.5 };
      cell.alignment = { vertical: 'middle', horizontal: i < 2 || i === 4 || i === 3 ? 'left' : 'center' };
      cell.border = { bottom: { style: 'thin', color: { argb: 'FFE2E9EA' } } };
      if (r % 2 === 1) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFAFBFB' } };
      }
    });
  });

  if (rows.length === 0) {
    sheet.mergeCells(headerRowIdx + 1, 1, headerRowIdx + 1, lastCol);
    const emptyCell = sheet.getCell(headerRowIdx + 1, 1);
    emptyCell.value = 'No sessions recorded yet.';
    emptyCell.font = { italic: true, color: { argb: 'FF94A3B8' } };
    emptyCell.alignment = { horizontal: 'center' };
  }

  return workbook.xlsx.writeBuffer();
}

async function sendRecordsReport(res, filename, options) {
  const buffer = await buildRecordsReport(options);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(Buffer.from(buffer));
}

module.exports = { buildRecordsReport, sendRecordsReport };
