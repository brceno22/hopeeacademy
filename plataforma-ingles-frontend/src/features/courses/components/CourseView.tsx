//CourseView.tsx
import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '@/core/api/axios';
import { cleanMoodleFileUrl, fetchFileProxyUrls } from '@/core/utils/fileProxy';
import { sanitizeHtml } from '@/core/utils/sanitize';
import { ForumView } from '@/features/forums/components/ForumView';
import { ExamView } from './ExamView';
import { ResourceFileViewer } from './ResourceFileViewer';
import { TaskView } from './TaskView';
import '../styles/course-view.css';

interface Module {
  id: number;
  name: string;
  type: string;
  category: string;
  description: string;
  url: string;
  fileUrl: string | null;
  instanceId?: number;
}

interface Section {
  id: number;
  name: string;
  summary: string;
  modules: Module[];
}

interface ExamSummary {
  id: number;
  title?: string;
}

const PLUGINFILE_RE = /(https?:\/\/[^"'\s]*?pluginfile\.php\/[^"'\s]*?)(?=["'\s])/g;

function embedYoutubeLinks(html: string): string {
  return html.replace(
    /<a[^>]*href="https?:\/\/(?:www\.)?(?:youtube\.com\/(?:[^/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|\S*?[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})"[^>]*>.*?<\/a>/gi,
    '<div style="position:relative; padding-bottom:56.25%; height:0; margin: 20px 0; border-radius: 12px; overflow: hidden;"><iframe style="position:absolute; top:0; left:0; width:100%; height:100%; border:0;" src="https://www.youtube.com/embed/$1" allowfullscreen></iframe></div>',
  );
}

/**
 * Los archivos de Moodle se sirven por el proxy con un ticket de corta
 * duración, así que primero hay que pedir los tickets de todas las URLs del
 * HTML en una sola llamada y después reescribirlo.
 */
async function rewriteMoodleMedia(html: string): Promise<string> {
  const matches = Array.from(html.matchAll(PLUGINFILE_RE), (m) => m[0]);
  const cleanedByOriginal = new Map(matches.map((url) => [url, cleanMoodleFileUrl(url)]));

  let proxied = new Map<string, string>();
  if (cleanedByOriginal.size > 0) {
    proxied = await fetchFileProxyUrls([...cleanedByOriginal.values()]);
  }

  const withProxiedMedia = html.replace(PLUGINFILE_RE, (match) => {
    const cleaned = cleanedByOriginal.get(match);
    return (cleaned && proxied.get(cleaned)) || match;
  });

  return sanitizeHtml(embedYoutubeLinks(withProxiedMedia));
}

export const CourseView: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [sections, setSections] = useState<Section[]>([]);
  const [activeModule, setActiveModule] = useState<Module | null>(null);
  const [loading, setLoading] = useState(true);
  const [examenes, setExamenes] = useState<ExamSummary[]>([]);
  const [completedModuleIds, setCompletedModuleIds] = useState<number[]>([]);
  const [markingId, setMarkingId] = useState<number | null>(null);
  const [markError, setMarkError] = useState('');
  const [error, setError] = useState('');
  const [renderedHtml, setRenderedHtml] = useState<{ moduleId: number; html: string } | null>(
    null,
  );

  useEffect(() => {
    const controller = new AbortController();

    const fetchContents = async () => {
      setLoading(true);
      setError('');
      try {
        const [contentsRes, examsRes, progressRes] = await Promise.all([
          api.get(`/courses/${id}/contents`, { signal: controller.signal }),
          api.get(`/exams/course/${id}`, { signal: controller.signal }),
          api.get(`/progress/course/${id}`, { signal: controller.signal }),
        ]);

        setSections(contentsRes.data);
        setExamenes(examsRes.data);
        setCompletedModuleIds(progressRes.data?.completedModuleIds || []);

        const firstSectionWithModules = contentsRes.data.find(
          (sec: Section) => sec.modules.length > 0,
        );
        if (firstSectionWithModules) {
          setActiveModule(firstSectionWithModules.modules[0]);
        }
      } catch (err: unknown) {
        if ((err as { code?: string })?.code === 'ERR_CANCELED') return;
        setError('Could not load the course. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    void fetchContents();
    return () => controller.abort();
  }, [id]);

  // Reescribir el HTML requiere pedir tickets al backend, así que no puede
  // hacerse durante el render.
  useEffect(() => {
    const moduleType = activeModule?.type?.replace(/"/g, '').trim();
    const description = activeModule?.description;
    const moduleId = activeModule?.id;

    if (!description || moduleId == null) return;
    if (moduleType !== 'label' && moduleType !== 'page') return;

    let cancelled = false;
    void (async () => {
      try {
        const html = await rewriteMoodleMedia(description);
        if (!cancelled) setRenderedHtml({ moduleId, html });
      } catch {
        // Sin tickets al menos se muestra el texto, con las imágenes rotas.
        if (!cancelled) setRenderedHtml({ moduleId, html: sanitizeHtml(description) });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activeModule]);

  // Derivado para no arrastrar el HTML del módulo anterior mientras carga.
  const moduleHtml =
    renderedHtml && renderedHtml.moduleId === activeModule?.id ? renderedHtml.html : '';

  const handleMarkAsCompleted = async () => {
    if (!activeModule) return;
    try {
      setMarkingId(activeModule.id);
      setMarkError('');
      await api.post('/progress/mark', {
        courseId: Number(id),
        moduleId: activeModule.id,
        type: 'manual',
      });
      setCompletedModuleIds((prev) => [...prev, activeModule.id]);
    } catch {
      setMarkError('Failed to save progress');
    } finally {
      setMarkingId(null);
    }
  };

  if (loading) {
    return (
      <div className="page-description" style={{ padding: '20px' }}>
        Setting up your classroom...
      </div>
    );
  }

  if (error) {
    return (
      <div className="home-card" style={{ margin: '20px' }}>
        <p className="page-description">{error}</p>
        <button type="button" className="btn-card primary" onClick={() => window.location.reload()}>
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="course-view-container">
      <aside className="course-sidebar">
        <button
          type="button"
          className="btn-back"
          onClick={() => navigate('/app/cursos')}
          style={{ marginBottom: '24px' }}
        >
          <span>←</span> Back to courses
        </button>

        <h3>Course outline</h3>

        {sections.map((section) => (
          <div key={section.id}>
            <h4>{section.name}</h4>
            {section.modules.filter((mod) => {
              const t = mod.type?.replace(/"/g, '').trim();
              return t !== 'lesson' && t !== 'quiz';
            }).length === 0 ? (
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>No content</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {section.modules
                  .filter((mod) => {
                    const t = mod.type?.replace(/"/g, '').trim();
                    return t !== 'lesson' && t !== 'quiz';
                  })
                  .map((mod) => (
                    <button
                      key={mod.id}
                      type="button"
                      onClick={() => setActiveModule(mod)}
                      className={`module-list-btn ${activeModule?.id === mod.id ? 'active' : ''}`}
                    >
                      <span style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <span style={{ opacity: 0.7 }}>📖</span>
                        <span
                          style={{
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {mod.name}
                        </span>
                      </span>
                      {completedModuleIds.includes(mod.id) && (
                        <span title="Completed" style={{ color: '#10B981' }}>
                          ✓
                        </span>
                      )}
                    </button>
                  ))}
              </div>
            )}
          </div>
        ))}

        {examenes.length > 0 && (
          <div>
            <h4>Assessments</h4>
            <button
              type="button"
              onClick={() =>
                setActiveModule({
                  id: -1,
                  name: 'Course exams',
                  type: 'lesson',
                  category: 'test',
                  description: '',
                  url: '',
                  fileUrl: null,
                })
              }
              className={`module-list-btn ${activeModule?.id === -1 ? 'active' : ''}`}
            >
              <span style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <span>📝</span> View all exams
              </span>
            </button>
          </div>
        )}
      </aside>

      <main className="course-main-content">
        {activeModule ? (
          <div
            style={{
              maxWidth: '900px',
              margin: '0 auto',
              display: 'flex',
              flexDirection: 'column',
              height: '100%',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
              <span className="module-badge">{activeModule.category.replace('_', ' ')}</span>
              <h1 style={{ margin: 0, fontSize: '1.8rem', color: 'var(--primary-color)' }}>
                {activeModule.name}
              </h1>
            </div>

            <div style={{ flex: 1, padding: '20px 0' }}>
              {(() => {
                const moduleType = activeModule.type?.replace(/"/g, '').trim();

                if (activeModule.category === 'tarea' || moduleType === 'assign') {
                  return <TaskView module={activeModule} />;
                }
                if (moduleType === 'forum') {
                  if (!activeModule.instanceId) {
                    return (
                      <p className="page-description">
                        Forum instance id missing for &quot;{activeModule.name}&quot;. Reload the
                        course or check the Moodle forum activity.
                      </p>
                    );
                  }
                  return <ForumView forumId={activeModule.instanceId} />;
                }
                if (
                  moduleType === 'lesson' ||
                  moduleType === 'quiz' ||
                  activeModule.category === 'test'
                ) {
                  return <ExamView module={activeModule} courseId={parseInt(id!, 10)} />;
                }

                if (moduleType === 'label' || moduleType === 'page') {
                  return moduleHtml ? (
                    <div
                      className="html-content-render"
                      dangerouslySetInnerHTML={{ __html: moduleHtml }}
                    />
                  ) : (
                    <p style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                      This section has no content.
                    </p>
                  );
                }

                if (moduleType === 'resource') {
                  const safeFileUrl = activeModule.fileUrl?.trim();
                  if (safeFileUrl) {
                    return (
                      <ResourceFileViewer
                        fileUrl={safeFileUrl}
                        title={activeModule.name}
                        moodleUrl={activeModule.url || undefined}
                      />
                    );
                  }
                  return (
                    <div className="home-card" style={{ textAlign: 'center', padding: 28 }}>
                      <p style={{ margin: '0 0 8px', color: 'var(--text-muted)' }}>
                        No file URL available for &quot;{activeModule.name}&quot;.
                      </p>
                      <p style={{ margin: 0, fontSize: '0.9rem', color: '#94a3b8' }}>
                        In Moodle, confirm the resource is a file (PDF) and you are enrolled in
                        this course, then reload.
                      </p>
                      {activeModule.url ? (
                        <p style={{ marginTop: 14 }}>
                          <a href={activeModule.url} target="_blank" rel="noopener noreferrer">
                            Open in Moodle
                          </a>
                        </p>
                      ) : null}
                    </div>
                  );
                }
                return (
                  <p className="page-description">Learning content: {activeModule.name}</p>
                );
              })()}
            </div>

            {(() => {
              const moduleType = activeModule.type?.replace(/"/g, '').trim();
              const isManualModule =
                moduleType !== 'forum' &&
                moduleType !== 'lesson' &&
                moduleType !== 'quiz' &&
                activeModule.category !== 'test';
              const isCompleted = completedModuleIds.includes(activeModule.id);

              if (!isManualModule) return null;

              return (
                <div
                  style={{
                    marginTop: 'auto',
                    paddingTop: '30px',
                    borderTop: '1px solid var(--border-color)',
                    textAlign: 'right',
                  }}
                >
                  {isCompleted ? (
                    <div className="success-badge">✅ Lesson completed</div>
                  ) : (
                    <>
                      {markError && (
                        <div
                          style={{
                            background: '#fef2f2',
                            border: '1px solid #fecaca',
                            color: '#ef4444',
                            padding: '16px',
                            borderRadius: '12px',
                            marginBottom: '24px',
                            fontWeight: '600',
                            textAlign: 'left',
                          }}
                        >
                          {markError}
                        </div>
                      )}
                      <button
                        type="button"
                        className="btn-success"
                        onClick={handleMarkAsCompleted}
                        disabled={markingId === activeModule.id}
                      >
                        {markingId === activeModule.id
                          ? 'Saving...'
                          : 'Mark as done ✓'}
                      </button>
                    </>
                  )}
                </div>
              );
            })()}
          </div>
        ) : (
          <div
            style={{
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-muted)',
            }}
          >
            <p>Select a lesson from the left menu to get started.</p>
          </div>
        )}
      </main>
    </div>
  );
};
