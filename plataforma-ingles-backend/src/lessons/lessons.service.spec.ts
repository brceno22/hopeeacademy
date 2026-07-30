import { pickResourceFileUrl } from './lessons.service';

describe('pickResourceFileUrl', () => {
  it('returns null when empty', () => {
    expect(pickResourceFileUrl(undefined)).toBeNull();
    expect(pickResourceFileUrl([])).toBeNull();
  });

  it('prefers PDF over other files', () => {
    const url = pickResourceFileUrl([
      { fileurl: 'https://m/pluginfile.php/1/a.docx', filename: 'a.docx' },
      { fileurl: 'https://m/pluginfile.php/1/b.pdf', filename: 'b.pdf', mimetype: 'application/pdf' },
    ]);
    expect(url).toContain('b.pdf');
  });

  it('falls back to first file with url', () => {
    const url = pickResourceFileUrl([
      { filename: 'no-url' },
      { fileurl: 'https://m/pluginfile.php/1/x.png', filename: 'x.png' },
    ]);
    expect(url).toContain('x.png');
  });
});
