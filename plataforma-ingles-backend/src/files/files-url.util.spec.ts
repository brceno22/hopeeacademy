import {
  candidatePluginfileBases,
  originsEquivalent,
  rewriteToMoodleOrigin,
} from './files-url.util';

describe('files-url.util', () => {
  it('treats localhost and 127.0.0.1 as equivalent', () => {
    expect(originsEquivalent('http://localhost:8080', 'http://127.0.0.1:8080')).toBe(true);
    expect(originsEquivalent('http://localhost:8080', 'http://127.0.0.1:9090')).toBe(false);
  });

  it('rewrites file host to Moodle origin', () => {
    const out = rewriteToMoodleOrigin(
      'http://localhost:8080/pluginfile.php/1/mod_resource/content/0/a.pdf',
      'http://127.0.0.1:8080',
    );
    expect(out.startsWith('http://127.0.0.1:8080/')).toBe(true);
    expect(out).toContain('a.pdf');
  });

  it('builds webservice then plain candidates for course files', () => {
    const bases = candidatePluginfileBases(
      'http://127.0.0.1:8080/pluginfile.php/1/mod_resource/content/0/a.pdf',
      false,
    );
    expect(bases[0]).toContain('/webservice/pluginfile.php');
    expect(bases[1]).toContain('/pluginfile.php');
    expect(bases[1]).not.toContain('/webservice/');
  });
});
