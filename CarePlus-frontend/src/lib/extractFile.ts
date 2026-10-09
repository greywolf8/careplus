import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import * as pdfjsLib from 'pdfjs-dist';
import mammoth from 'mammoth/mammoth.browser';

// Configure the PDF.js worker for the browser (Vite resolves the ?url asset).
pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB
const ALLOWED = /\.(pdf|docx|txt)$/i;

export function isSupportedUpload(name: string, type?: string): boolean {
  return (
    ALLOWED.test(name) ||
    type === 'application/pdf' ||
    type === 'text/plain' ||
    type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  );
}

async function fromTxt(file: File): Promise<string> {
  return (await file.text()).trim();
}

async function fromDocx(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  const text = (result.value || '').trim();
  if (!text) throw new Error('No readable text found in the DOCX');
  return text;
}

async function fromPdf(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;
  let out = '';
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    let pageText = '';
    let lastY: number | undefined;
    for (const item of content.items) {
      if (!('str' in item)) continue;
      const anyItem = item as unknown as { str: string; hasEOL?: boolean; transform?: number[] };
      // Insert a newline when vertical position changes (new line) or EOL flag.
      const y = anyItem.transform ? anyItem.transform[5] : undefined;
      if (lastY !== undefined && y !== undefined && Math.abs(y - lastY) > 1) {
        pageText += '\n';
      }
      pageText += anyItem.str;
      if (anyItem.hasEOL) pageText += '\n';
      lastY = y;
    }
    out += pageText.replace(/[ \t]+/g, ' ').trim() + '\n\n';
  }
  await pdf.cleanup();
  const text = out.trim();
  if (!text) throw new Error('No readable text found in the PDF (it may be scanned images)');
  return text;
}

/**
 * Extract plain text from an uploaded discharge-summary file (PDF/DOCX/TXT).
 * Throws a user-friendly error for unsupported types or unreadable files.
 */
export async function extractTextFromFile(file: File): Promise<string> {
  if (file.size > MAX_BYTES) {
    throw new Error('File exceeds the 10 MB limit');
  }
  const name = file.name.toLowerCase();
  if (name.endsWith('.txt')) return fromTxt(file);
  if (name.endsWith('.docx')) return fromDocx(file);
  if (name.endsWith('.pdf')) return fromPdf(file);
  if (!isSupportedUpload(file.name, file.type)) {
    throw new Error('Unsupported file type. Please upload a PDF, DOCX, or TXT file.');
  }
  // Unknown extension but a supported MIME type: default to text.
  return fromTxt(file);
}
