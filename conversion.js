export const MAX_BYTES = 131072;
export const OPERATIONS = ['csv-to-json', 'json-to-csv', 'format-json', 'minify-json', 'validate-json'];
function fail(message) { throw new Error(message); }
export function parseCSV(input) {
  const text = input.replace(/^\uFEFF/, '');
  if (!text.length) fail('CSV is empty.');
  const rows = []; let row = [], field = '', quoted = false, closed = false;
  function cell() { row.push(field); field = ''; closed = false; }
  function record() { cell(); rows.push(row); row = []; if (rows.length > 2001) fail('Maximum 2,000 data rows.'); }
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else { quoted = false; closed = true; } }
      else field += ch;
    } else if (ch === ',') cell();
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; record(); }
    else if (ch === '"' && !field.length && !closed) quoted = true;
    else { if (closed || ch === '"') fail('Invalid CSV quoting.'); field += ch; }
  }
  if (quoted) fail('Unclosed quoted CSV field.');
  if (row.length || field.length || closed) record();
  if (!rows.length) fail('CSV is empty.');
  const headers = rows.shift();
  if (headers.some(h => !h.trim()) || new Set(headers).size !== headers.length) fail('CSV headers must be non-empty and unique.');
  if (headers.length > 100) fail('Maximum 100 columns.');
  return rows.map((r, index) => { if (r.length !== headers.length) fail(`Row ${index + 2} has ${r.length} cells; expected ${headers.length}.`); return Object.fromEntries(headers.map((h, i) => [h, r[i]])); });
}
function csvCell(value) {
  let text = value == null ? '' : typeof value === 'object' ? JSON.stringify(value) : String(value);
  // Protect string cells against spreadsheet formula execution. Numeric negatives remain numeric.
  if (typeof value === 'string' && /^[\s]*[=+\-@]/.test(text)) text = "'" + text;
  return /[",\r\n]/.test(text) ? '"' + text.replaceAll('"', '""') + '"' : text;
}
export function toCSV(data) {
  if (!Array.isArray(data) || !data.length || data.some(r => !r || typeof r !== 'object' || Array.isArray(r))) fail('Use a non-empty JSON array of objects.');
  if (data.length > 2000) fail('Maximum 2,000 rows.');
  const keys = [...new Set(data.flatMap(r => Object.keys(r)))];
  if (!keys.length || keys.length > 100) fail('Use between 1 and 100 columns.');
  return [keys.map(csvCell).join(','), ...data.map(r => keys.map(k => csvCell(Object.hasOwn(r, k) ? r[k] : null)).join(','))].join('\r\n');
}
export function convert(operation, input) {
  if (!OPERATIONS.includes(operation)) fail('Unsupported operation.');
  if (typeof input !== 'string') fail('Input must be a string.');
  if (new TextEncoder().encode(input).length > MAX_BYTES) fail('Input exceeds 128 KiB.');
  let output, mimeType, extension;
  if (operation === 'csv-to-json') { output = JSON.stringify(parseCSV(input), null, 2); mimeType = 'application/json'; extension = 'json'; }
  else {
    let parsed; try { parsed = JSON.parse(input); } catch (_) { fail('Invalid JSON. Check quotation marks, commas, and brackets.'); }
    if (operation === 'json-to-csv') { output = toCSV(parsed); mimeType = 'text/csv'; extension = 'csv'; }
    else { output = operation === 'validate-json' ? JSON.stringify({valid:true,type:Array.isArray(parsed)?'array':parsed===null?'null':typeof parsed}, null, 2) : JSON.stringify(parsed, null, operation === 'minify-json' ? undefined : 2); mimeType = 'application/json'; extension = 'json'; }
  }
  if (new TextEncoder().encode(output).length > MAX_BYTES * 4) fail('Output exceeds 512 KiB.');
  return {output, mimeType, extension};
}
