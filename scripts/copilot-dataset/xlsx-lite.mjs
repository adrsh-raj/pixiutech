/**
 * Minimal dependency-free XLSX writer/reader for the Phase 2 human-review flow.
 * Writes valid Office Open XML with stored ZIP entries; reads stored/deflated
 * XLSX entries so Excel and LibreOffice can save the reviewer workbook.
 */
import { deflateRawSync, inflateRawSync } from 'node:zlib';

const UTF8 = new TextEncoder();
const DECODER = new TextDecoder('utf-8');
function u16(n) { return Uint8Array.of(n & 255, (n >>> 8) & 255); }
function u32(n) { return Uint8Array.of(n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255); }
function concat(parts) {
  const size = parts.reduce((sum, item) => sum + item.length, 0);
  const out = new Uint8Array(size); let offset = 0;
  for (const item of parts) { out.set(item, offset); offset += item.length; }
  return out;
}
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    table[n] = c >>> 0;
  }
  return table;
})();
function crc32(bytes) {
  let c = 0xffffffff;
  for (const byte of bytes) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function zipStore(entries) {
  const locals = [], centrals = []; let offset = 0;
  for (const [name, content] of Object.entries(entries)) {
    const nameBytes = UTF8.encode(name), data = typeof content === 'string' ? UTF8.encode(content) : content;
    const crc = crc32(data), size = data.length;
    const local = concat([
      u32(0x04034b50), u16(20), u16(0x0800), u16(0), u16(0), u16(0), u32(crc), u32(size), u32(size),
      u16(nameBytes.length), u16(0), nameBytes, data,
    ]);
    locals.push(local);
    centrals.push(concat([
      u32(0x02014b50), u16(20), u16(20), u16(0x0800), u16(0), u16(0), u16(0), u32(crc), u32(size), u32(size),
      u16(nameBytes.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(offset), nameBytes,
    ]));
    offset += local.length;
  }
  const central = concat(centrals);
  const end = concat([u32(0x06054b50), u16(0), u16(0), u16(centrals.length), u16(centrals.length), u32(central.length), u32(offset), u16(0)]);
  return concat([...locals, central, end]);
}
function xmlEscape(value) {
  return String(value ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\"/g, '&quot;').replace(/'/g, '&apos;');
}
function colName(index) {
  let n = index + 1, out = '';
  while (n > 0) { const rem = (n - 1) % 26; out = String.fromCharCode(65 + rem) + out; n = Math.floor((n - 1) / 26); }
  return out;
}
function cellXml(value, row, col, style = 0) {
  if (value === null || value === undefined || value === '') return '';
  const ref = colName(col) + row;
  return `<c r="${ref}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${xmlEscape(value)}</t></is></c>`;
}
function worksheetXml({ rows, widths = [], freeze = true, filter = false, validations = [], rowHeights = {} }) {
  const maxCols = Math.max(1, ...rows.map((r) => r.length));
  const lastCol = colName(maxCols - 1), lastRow = Math.max(1, rows.length);
  const cols = widths.length ? `<cols>${widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${Math.max(8, Math.min(65, Number(w) || 16))}" customWidth="1"/>`).join('')}</cols>` : '';
  const sheetViews = freeze ? '<sheetViews><sheetView workbookViewId="0"><pane xSplit="3" ySplit="1" topLeftCell="D2" activePane="bottomRight" state="frozen"/><selection pane="topRight" activeCell="D1" sqref="D1"/><selection pane="bottomLeft" activeCell="A2" sqref="A2"/><selection pane="bottomRight" activeCell="D2" sqref="D2"/></sheetView></sheetViews>' : '<sheetViews><sheetView workbookViewId="0"/></sheetViews>';
  const body = rows.map((row, rIndex) => {
    const excelRow = rIndex + 1;
    const style = rIndex === 0 ? 1 : 0;
    const cells = row.map((v, cIndex) => cellXml(v, excelRow, cIndex, style)).join('');
    const ht = rowHeights[excelRow] ? ` ht="${rowHeights[excelRow]}" customHeight="1"` : '';
    return `<row r="${excelRow}"${ht}>${cells}</row>`;
  }).join('');
  const autoFilter = filter ? `<autoFilter ref="A1:${lastCol}${lastRow}"/>` : '';
  const dataValidations = validations.length ? `<dataValidations count="${validations.length}">${validations.map(v => `<dataValidation type="list" allowBlank="1" showErrorMessage="1" sqref="${v.ref}"><formula1>${xmlEscape(v.formula)}</formula1></dataValidation>`).join('')}</dataValidations>` : '';
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><dimension ref="A1:${lastCol}${lastRow}"/>${sheetViews}<sheetFormatPr defaultRowHeight="36"/>${cols}<sheetData>${body}</sheetData>${autoFilter}${dataValidations}<pageMargins left="0.25" right="0.25" top="0.5" bottom="0.5" header="0.2" footer="0.2"/></worksheet>`;
}
function workbookEntries(sheets) {
  const sheetNodes = sheets.map((s, i) => `<sheet name="${xmlEscape(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('');
  const sheetRels = sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('');
  const styleId = `rId${sheets.length + 1}`;
  const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="10"/><name val="Aptos"/></font><font><b/><sz val="10"/><color rgb="FFFFFFFF"/><name val="Aptos Display"/></font></fonts><fills count="4"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF142E45"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFE8EFF4"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left style="thin"><color rgb="FFD5DEE6"/></left><right style="thin"><color rgb="FFD5DEE6"/></right><top style="thin"><color rgb="FFD5DEE6"/></top><bottom style="thin"><color rgb="FFD5DEE6"/></bottom><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf><xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFill="1" applyFont="1" applyBorder="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf><xf numFmtId="0" fontId="0" fillId="3" borderId="1" xfId="0" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
  const contentTypes = `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`;
  const entries = {
    '[Content_Types].xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>${contentTypes}`,
    '_rels/.rels': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    'xl/workbook.xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><bookViews><workbookView activeTab="0"/></bookViews><sheets>${sheetNodes}</sheets><calcPr calcId="191029"/></workbook>`,
    'xl/_rels/workbook.xml.rels': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheetRels}<Relationship Id="${styleId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
    'xl/styles.xml': styles,
  };
  sheets.forEach((s, i) => { entries[`xl/worksheets/sheet${i + 1}.xml`] = worksheetXml(s); });
  return entries;
}
export function buildXlsx(sheets) { return Buffer.from(zipStore(workbookEntries(sheets))); }

function zipRead(buffer) {
  const bytes = new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  let eocd = -1;
  for (let i = Math.max(0, bytes.length - 65557); i <= bytes.length - 22; i++) {
    if (bytes[i] === 0x50 && bytes[i + 1] === 0x4b && bytes[i + 2] === 0x05 && bytes[i + 3] === 0x06) eocd = i;
  }
  if (eocd < 0) throw new Error('Not a valid XLSX/ZIP file (end-of-central-directory not found).');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const count = view.getUint16(eocd + 10, true), centralOffset = view.getUint32(eocd + 16, true);
  const files = new Map(); let p = centralOffset;
  for (let i = 0; i < count; i++) {
    if (view.getUint32(p, true) !== 0x02014b50) throw new Error('Invalid XLSX central-directory entry.');
    const method = view.getUint16(p + 10, true), compressedSize = view.getUint32(p + 20, true);
    const nameLen = view.getUint16(p + 28, true), extraLen = view.getUint16(p + 30, true), commentLen = view.getUint16(p + 32, true), localOffset = view.getUint32(p + 42, true);
    const name = DECODER.decode(bytes.slice(p + 46, p + 46 + nameLen));
    const localNameLen = view.getUint16(localOffset + 26, true), localExtraLen = view.getUint16(localOffset + 28, true);
    const start = localOffset + 30 + localNameLen + localExtraLen;
    const compressed = bytes.slice(start, start + compressedSize);
    let data;
    if (method === 0) data = compressed;
    else if (method === 8) data = new Uint8Array(inflateRawSync(compressed));
    else throw new Error(`Unsupported XLSX ZIP compression method ${method} for ${name}`);
    files.set(name, DECODER.decode(data));
    p += 46 + nameLen + extraLen + commentLen;
  }
  return files;
}
function xmlUnescape(s) {
  return String(s ?? '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
}
function getAttr(tag, name) {
  const re = new RegExp(`(?:^|\\s)${name}="([^"]*)"`);
  return tag.match(re)?.[1] ?? null;
}
function columnIndex(ref) {
  const label = String(ref).match(/^[A-Z]+/)?.[0];
  if (!label) return -1;
  let n = 0; for (const c of label) n = n * 26 + c.charCodeAt(0) - 64;
  return n - 1;
}
function parseWorksheet(xml, sharedStrings) {
  const rows = [];
  const rowRe = /<row\b[^>]*>([\s\S]*?)<\/row>/g; let rowMatch;
  while ((rowMatch = rowRe.exec(xml))) {
    const cells = []; const cellRe = /<c\b([^>]*?)(?:\s*\/>|>([\s\S]*?)<\/c>)/g; let cellMatch;
    while ((cellMatch = cellRe.exec(rowMatch[1]))) {
      const attrs = cellMatch[1], body = cellMatch[2] || '', ref = getAttr(attrs, 'r'), type = getAttr(attrs, 't');
      if (!ref) continue;
      if (/<f(?:\s|>)/.test(body)) throw new Error(`Formula found in review worksheet cell ${ref}; decisions workbook must contain values only.`);
      let value = '';
      if (type === 's') {
        const idx = Number(body.match(/<v>([\s\S]*?)<\/v>/)?.[1]); value = sharedStrings[idx] ?? '';
      } else if (type === 'inlineStr') {
        value = [...body.matchAll(/<t(?:\s+[^>]*)?>([\s\S]*?)<\/t>/g)].map(m => xmlUnescape(m[1])).join('');
      } else {
        const raw = body.match(/<v>([\s\S]*?)<\/v>/)?.[1]; value = raw === undefined ? '' : xmlUnescape(raw);
      }
      cells[columnIndex(ref)] = value;
    }
    const lastColumn = cells.length;
    rows.push(Array.from({ length: lastColumn }, (_, index) => cells[index] ?? ''));
  }
  return rows;
}
export function readReviewQueueSheet(buffer, wantedName = 'Review Queue') {
  const files = zipRead(buffer);
  const workbook = files.get('xl/workbook.xml');
  const relsXml = files.get('xl/_rels/workbook.xml.rels');
  if (!workbook || !relsXml) throw new Error('XLSX is missing workbook.xml or workbook relationships.');
  const rels = new Map();
  for (const m of relsXml.matchAll(/<Relationship\b([^>]*?)\/?\s*>/g)) rels.set(getAttr(m[1], 'Id'), getAttr(m[1], 'Target'));
  let sheetRel = null;
  for (const m of workbook.matchAll(/<sheet\b([^>]*?)\/?\s*>/g)) {
    if (xmlUnescape(getAttr(m[1], 'name')) === wantedName) { sheetRel = rels.get(getAttr(m[1], 'r:id')); break; }
  }
  if (!sheetRel) throw new Error(`Workbook is missing the '${wantedName}' worksheet.`);
  let sheetPath = sheetRel.replace(/^\//, '');
  if (!sheetPath.startsWith('xl/')) sheetPath = `xl/${sheetPath.replace(/^\.\//, '')}`;
  const sheetXml = files.get(sheetPath);
  if (!sheetXml) throw new Error(`Could not locate worksheet XML at ${sheetPath}.`);
  let sharedStrings = [];
  const shared = files.get('xl/sharedStrings.xml');
  if (shared) sharedStrings = [...shared.matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)].map(m => [...m[1].matchAll(/<t(?:\s+[^>]*)?>([\s\S]*?)<\/t>/g)].map(t => xmlUnescape(t[1])).join(''));
  return parseWorksheet(sheetXml, sharedStrings);
}
export function parseCsv(text) {
  const out = []; let row = [], field = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"' && field.length === 0) quoted = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field.replace(/\r$/, '')); out.push(row); row = []; field = ''; }
    else field += c;
  }
  if (quoted) throw new Error('CSV has an unterminated quoted field.');
  if (field.length || row.length) { row.push(field.replace(/\r$/, '')); out.push(row); }
  return out;
}
