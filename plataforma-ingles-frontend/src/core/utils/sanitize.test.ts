import { describe, expect, it } from 'vitest';
import { sanitizeHtml } from '@/core/utils/sanitize';

describe('sanitizeHtml', () => {
  it.each([null, undefined, ''])('returns an empty string for %p', (value) => {
    expect(sanitizeHtml(value)).toBe('');
  });

  it('removes script tags and their contents', () => {
    const clean = sanitizeHtml('<p>Hola</p><script>alert(1)</script>');

    expect(clean).toBe('<p>Hola</p>');
  });

  it('strips inline event handlers', () => {
    const clean = sanitizeHtml('<img src="a.png" onerror="alert(1)">');

    expect(clean).toContain('src="a.png"');
    expect(clean).not.toContain('onerror');
  });

  it('strips javascript: urls from links', () => {
    const clean = sanitizeHtml('<a href="javascript:alert(1)">click</a>');

    expect(clean).not.toContain('javascript:');
  });

  it('drops tags that are not on the allow list', () => {
    const clean = sanitizeHtml('<form><input name="x"><p>keep</p></form>');

    expect(clean).not.toContain('<form');
    expect(clean).not.toContain('<input');
    expect(clean).toContain('<p>keep</p>');
  });

  it('drops data attributes', () => {
    const clean = sanitizeHtml('<p data-secret="x">hi</p>');

    expect(clean).not.toContain('data-secret');
  });

  it('keeps the formatting Moodle content relies on', () => {
    const html =
      '<h2>Unit 1</h2><p><strong>bold</strong> and <em>italic</em></p>' +
      '<ul><li>one</li></ul><table><tbody><tr><td>cell</td></tr></tbody></table>';

    expect(sanitizeHtml(html)).toBe(html);
  });

  it('keeps embedded iframes, which CourseView uses for YouTube', () => {
    const clean = sanitizeHtml(
      '<iframe src="https://www.youtube.com/embed/abc" allowfullscreen></iframe>',
    );

    expect(clean).toContain('<iframe');
    expect(clean).toContain('src="https://www.youtube.com/embed/abc"');
  });

  it('keeps audio and video players used by exam questions', () => {
    const clean = sanitizeHtml('<audio controls><source src="a.mp3"></audio>');

    expect(clean).toContain('<audio');
    expect(clean).toContain('controls');
    expect(clean).toContain('src="a.mp3"');
  });
});
