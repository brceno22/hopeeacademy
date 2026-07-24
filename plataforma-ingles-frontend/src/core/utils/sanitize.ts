import DOMPurify from 'dompurify';

const ALLOWED_TAGS = [
  'a',
  'b',
  'br',
  'div',
  'em',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'i',
  'iframe',
  'img',
  'li',
  'ol',
  'p',
  'span',
  'strong',
  'u',
  'ul',
  'video',
  'audio',
  'source',
  'table',
  'thead',
  'tbody',
  'tr',
  'th',
  'td',
];

const ALLOWED_ATTR = [
  'href',
  'src',
  'alt',
  'title',
  'class',
  'style',
  'target',
  'rel',
  'controls',
  'width',
  'height',
  'frameborder',
  'allow',
  'allowfullscreen',
];

/** Sanitiza HTML proveniente de Moodle antes de inyectarlo en el DOM. */
export function sanitizeHtml(dirty: string | null | undefined): string {
  if (!dirty) return '';
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOW_DATA_ATTR: false,
  });
}
