import { decode as base64Decode, encode as base64Encode } from 'base-64';
import { unzipSync } from 'fflate';
import RNFS from 'react-native-fs';
import { NativeModules } from 'react-native';

// Polyfill for React Native Hermes engine
if (typeof globalThis.atob === 'undefined') {
  (globalThis as any).atob = base64Decode;
}
if (typeof globalThis.btoa === 'undefined') {
  (globalThis as any).btoa = base64Encode;
}

// Native module for PDF extraction
const { PdfExtractor } = NativeModules;

// ── Shared helpers ────────────────────────────────────────────────────────────

async function readFileAsBase64(uri: string): Promise<string> {
  const path = uri.replace(/^file:\/\//, '');
  return RNFS.readFile(path, 'base64');
}

function base64ToUint8Array(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

// Manual UTF-8 decoder (TextDecoder not available in Hermes)
function uint8ToString(bytes: Uint8Array): string {
  let result = '';
  let i = 0;
  while (i < bytes.length) {
    const b1 = bytes[i++];
    if ((b1 & 0x80) === 0) {
      result += String.fromCharCode(b1);
    } else if ((b1 & 0xE0) === 0xC0) {
      if (i >= bytes.length) { result += '\uFFFD'; break; }
      const b2 = bytes[i++];
      result += String.fromCharCode(((b1 & 0x1F) << 6) | (b2 & 0x3F));
    } else if ((b1 & 0xF0) === 0xE0) {
      if (i + 1 >= bytes.length) { result += '\uFFFD'; break; }
      const b2 = bytes[i++];
      const b3 = bytes[i++];
      result += String.fromCharCode(((b1 & 0x0F) << 12) | ((b2 & 0x3F) << 6) | (b3 & 0x3F));
    } else if ((b1 & 0xF8) === 0xF0) {
      if (i + 2 >= bytes.length) { result += '\uFFFD'; break; }
      const b2 = bytes[i++];
      const b3 = bytes[i++];
      const b4 = bytes[i++];
      const cp = ((b1 & 0x07) << 18) | ((b2 & 0x3F) << 12) | ((b3 & 0x3F) << 6) | (b4 & 0x3F);
      if (cp > 0x10FFFF) {
        result += '\uFFFD';
      } else {
        result += String.fromCodePoint(cp);
      }
    } else {
      result += '\uFFFD';
    }
  }
  return result;
}

// ── PDF Text Extraction (Native) ───────────────────────────────────────────────

function formatPdfText(text: string): string {
  // Normalize line endings
  let result = text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n');

  // Split into lines for analysis
  const lines = result.split('\n');
  const processedLines: string[] = [];

  // Patterns that indicate intentional line breaks
  const endPunctuation = /[.!?。？！'"）\)]$/;
  const startCapital = /^[A-ZÀ-ÖØ-ÝА-ЯЁ]/;
  const listMarker = /^[-•◦▪▫○●]\s/;
  const numberedItem = /^\d+[.)]\s/;
  const shortLineMax = 60; // Lines shorter than this might be headings/titles

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const prevLine = i > 0 ? lines[i - 1].trim() : '';

    // Empty lines are paragraph breaks
    if (line === '') {
      processedLines.push('');
      continue;
    }

    // Check if this line should start a new paragraph
    const isParagraphStart =
      // Previous line was empty
      prevLine === '' ||
      // Previous line ended with sentence-ending punctuation
      endPunctuation.test(prevLine) ||
      // This line starts with capital and previous was short (likely heading)
      (startCapital.test(line) && prevLine.length > 0 && prevLine.length < shortLineMax) ||
      // This line is a list item
      listMarker.test(line) ||
      numberedItem.test(line) ||
      // Previous line was a list item
      listMarker.test(prevLine) ||
      numberedItem.test(prevLine) ||
      // Very short line followed by capital (heading pattern)
      (prevLine.length > 0 && prevLine.length < 30 && startCapital.test(line));

    if (i === 0) {
      processedLines.push(line);
    } else if (isParagraphStart) {
      // Start a new paragraph
      if (processedLines[processedLines.length - 1] !== '') {
        processedLines.push('');
      }
      processedLines.push(line);
    } else {
      // Join with previous line (arbitrary PDF line break)
      processedLines[processedLines.length - 1] += ' ' + line;
    }
  }

  return processedLines
    .join('\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export async function extractPdfText(uri: string): Promise<string> {
  if (!PdfExtractor) {
    throw new Error(
      'PDF extraction not available.\n\n' +
      'Please rebuild the app:\n' +
      '- iOS: Run "npx pod-install && npm run ios"\n' +
      '- Android: Run "npm run android"'
    );
  }

  const text = await PdfExtractor.extractText(uri);

  if (!text || !text.trim()) {
    throw new Error('No text found. PDF may be scanned (image-based).');
  }

  return formatPdfText(text);
}

// ── DOCX Text Extraction ──────────────────────────────────────────────────────

function decodeXmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => {
      const cp = parseInt(hex, 16);
      return cp > 0x10FFFF ? '\uFFFD' : String.fromCodePoint(cp);
    })
    .replace(/&#(\d+);/g, (_, num) => {
      const cp = parseInt(num, 10);
      return cp > 0x10FFFF ? '\uFFFD' : String.fromCodePoint(cp);
    });
}

function extractXmlText(xml: string): string {
  // Add newlines at paragraph END tags, not start
  let text = xml
    .replace(/<\/w:p>/gi, '\n\n')
    .replace(/<w:br[^>]*\/>/gi, '\n')
    .replace(/<[^>]+>/g, '');

  text = decodeXmlEntities(text);

  return text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export async function extractDocxText(uri: string): Promise<string> {
  const base64 = await readFileAsBase64(uri);
  const bytes = base64ToUint8Array(base64);

  const files = unzipSync(bytes);
  const docXml = files['word/document.xml'];
  if (!docXml) {
    throw new Error('Invalid DOCX: word/document.xml not found');
  }

  const text = extractXmlText(uint8ToString(docXml));
  if (!text.trim()) {
    throw new Error('No text found in DOCX');
  }

  return text;
}

// ── EPUB Text Extraction ──────────────────────────────────────────────────────

function getXmlAttr(tag: string, attr: string): string {
  const match = new RegExp(attr + '="([^"]*)"', 'i').exec(tag);
  return match ? match[1] : '';
}

function extractHtmlText(html: string): string {
  // Skip if this looks like CSS
  if (/^\s*(body|div|p|h[1-6]|img|\.)[\s{]/i.test(html) && !/<\s*(html|body|p|div|h[1-6])/i.test(html)) {
    return '';
  }

  // Remove script, style, and head blocks
  let cleaned = html.replace(/<(script|style|head)[^>]*>[\s\S]*?<\/\1>/gi, '');

  // Mark block boundaries with placeholders
  cleaned = cleaned
    .replace(/<\/p>/gi, ' [[PARA]] ')
    .replace(/<\/h[1-6]>/gi, ' [[PARA]] ')
    .replace(/<\/li>/gi, ' [[PARA]] ')
    .replace(/<br\s*\/?>/gi, ' [[BR]] ')
    .replace(/<\/div>/gi, ' [[DIV]] ')
    // Remove all remaining tags
    .replace(/<[^>]+>/g, ' ');

  // Decode entities
  cleaned = decodeXmlEntities(cleaned);

  // Normalize all whitespace to single spaces first
  cleaned = cleaned.replace(/\s+/g, ' ');

  // Convert markers back to newlines
  cleaned = cleaned
    .replace(/\s*\[\[PARA\]\]\s*/g, '\n\n')
    .replace(/\s*\[\[BR\]\]\s*/g, '\n')
    .replace(/\s*\[\[DIV\]\]\s*/g, '\n');

  return cleaned
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export async function extractEpubText(uri: string): Promise<string> {
  const base64 = await readFileAsBase64(uri);
  const bytes = base64ToUint8Array(base64);

  const files = unzipSync(bytes);

  const containerXml = files['META-INF/container.xml'];
  if (!containerXml) {
    throw new Error('Invalid EPUB: META-INF/container.xml not found');
  }

  const containerStr = uint8ToString(containerXml);
  const opfPathMatch = containerStr.match(/full-path="([^"]+)"/i);
  if (!opfPathMatch) {
    throw new Error('Invalid EPUB: OPF path not found in container.xml');
  }
  const opfPath = opfPathMatch[1];

  const opfBytes = files[opfPath];
  if (!opfBytes) {
    throw new Error('Invalid EPUB: OPF file not found at ' + opfPath);
  }

  const opfStr = uint8ToString(opfBytes);
  const opfDir = opfPath.includes('/') ? opfPath.substring(0, opfPath.lastIndexOf('/') + 1) : '';

  const manifest: Record<string, string> = {};
  const manifestRegex = /<item\s+[^>]*>/gi;
  let match;
  while ((match = manifestRegex.exec(opfStr)) !== null) {
    const item = match[0];
    const id = getXmlAttr(item, 'id');
    const href = getXmlAttr(item, 'href');
    const mediaType = getXmlAttr(item, 'media-type').toLowerCase();

    // Only include actual content documents (not nav, ncx, css, etc.)
    const isContent = (
      (mediaType.includes('html') || mediaType.includes('xhtml') ||
       href.endsWith('.html') || href.endsWith('.xhtml') || href.endsWith('.htm')) &&
      !id.toLowerCase().includes('nav') &&
      !id.toLowerCase().includes('ncx') &&
      !href.toLowerCase().includes('nav.') &&
      !mediaType.includes('ncx')
    );

    if (id && href && isContent) {
      manifest[id] = href;
    }
  }

  const spineIds: string[] = [];
  const spineRegex = /<itemref\s+[^>]*>/gi;
  while ((match = spineRegex.exec(opfStr)) !== null) {
    const idref = getXmlAttr(match[0], 'idref');
    if (idref && manifest[idref]) {
      spineIds.push(idref);
    }
  }

  if (spineIds.length === 0) {
    throw new Error('No readable content found in EPUB spine');
  }

  const textParts: string[] = [];
  for (const id of spineIds) {
    const href = manifest[id];
    const fullPath = opfDir + href;
    const contentBytes = files[fullPath] ?? files[href];

    if (contentBytes) {
      const html = uint8ToString(contentBytes);
      const text = extractHtmlText(html);
      if (text.trim()) {
        textParts.push(text);
      }
    }
  }

  if (textParts.length === 0) {
    throw new Error('No text could be extracted from EPUB');
  }

  return textParts.join('\n\n');
}
