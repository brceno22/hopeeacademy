//CourseView.tsx
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ForumView } from '@/features/forums/components/ForumView';
import  api  from '../../../core/api/axios';
import { TaskView } from './TaskView';
import { ExamView } from './ExamView';

import '../styles/course-view.css'; // Importamos los estilos del aula

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

export const CourseView: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const token = localStorage.getItem('token');
  const navigate = useNavigate();
  
  const [sections, setSections] = useState<Section[]>([]);
  const [activeModule, setActiveModule] = useState<Module | null>(null);
  const [loading, setLoading] = useState(true);
  const [examenes, setExamenes] = useState<any[]>([]);
  const [completedModuleIds, setCompletedModuleIds] = useState<number[]>([]);
  const [markingId, setMarkingId] = useState<number | null>(null); 

  useEffect(() => {
    const fetchContents = async () => {
      try {
        const [contentsRes, examsRes, progressRes] = await Promise.all([
          api.get(`/courses/${id}/contents`),
          api.get(`/exams/course/${id}`),
          api.get(`/progress/course/${id}`)
        ]);
        
        setSections(contentsRes.data);
        setExamenes(examsRes.data);
        setCompletedModuleIds(progressRes.data?.completedModuleIds || []);

        const firstSectionWithModules = contentsRes.data.find((sec: Section) => sec.modules.length > 0);
        if (firstSectionWithModules) {
          setActiveModule(firstSectionWithModules.modules[0]);
        }
      } catch (err) {
        console.error('Error al cargar el curso', err);
      } finally {
        setLoading(false);
      }
    };
    fetchContents();
  }, [id]);

  const handleMarkAsCompleted = async () => {
    if (!activeModule) return;
    try {
      setMarkingId(activeModule.id);
      await api.post('/progress/mark', {
        courseId: Number(id),
        moduleId: activeModule.id,
        type: 'manual'
      });
      setCompletedModuleIds(prev => [...prev, activeModule.id]);
    } catch (error) {
      alert('Error al guardar el progreso');
    } finally {
      setMarkingId(null);
    }
  };

  if (loading) return <div className="page-description" style={{ padding: '20px' }}>Preparando el aula virtual...</div>;

  return (
    <div className="course-view-container">
      
      {/* COLUMNA IZQUIERDA (ÍNDICE) */}
      <aside className="course-sidebar">
        <button className="btn-back" onClick={() => navigate('/app/cursos')} style={{ marginBottom: '24px' }}>
          <span>←</span> Volver al Panel
        </button>
        
        <h3>Índice del Curso</h3>

        {sections.map((section) => (
          <div key={section.id}>
            <h4>{section.name}</h4>
            {section.modules.filter(mod => {
              const t = mod.type?.replace(/"/g, '').trim();
              return t !== 'lesson' && t !== 'quiz';
            }).length === 0 ? (
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Sin contenido</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {section.modules
                  .filter(mod => {
                    const t = mod.type?.replace(/"/g, '').trim();
                    return t !== 'lesson' && t !== 'quiz';
                  })
                  .map((mod) => (
                    <button
                      key={mod.id}
                      onClick={() => setActiveModule(mod)}
                      className={`module-list-btn ${activeModule?.id === mod.id ? 'active' : ''}`}
                    >
                      <span style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <span style={{ opacity: 0.7 }}>📖</span> 
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{mod.name}</span>
                      </span>
                      {completedModuleIds.includes(mod.id) && <span title="Completado" style={{ color: '#10B981' }}>✓</span>}
                    </button>
                  ))}
              </div>
            )}
          </div>
        ))}

        {examenes.length > 0 && (
          <div>
            <h4>Evaluaciones</h4>
            <button
              onClick={() => setActiveModule({
                id: -1, name: 'Exámenes del Curso', type: 'lesson', category: 'test', description: '', url: '', fileUrl: null,
              })}
              className={`module-list-btn ${activeModule?.id === -1 ? 'active' : ''}`}
            >
              <span style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <span>📝</span> Ver todos los exámenes
              </span>
            </button>
          </div>
        )}
      </aside>

      {/* COLUMNA DERECHA (CONTENIDO) */}
      <main className="course-main-content">
        {activeModule ? (
          <div style={{ maxWidth: '900px', margin: '0 auto', display: 'flex', flexDirection: 'column', height: '100%' }}>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
              <span className="module-badge">
                {activeModule.category.replace('_', ' ')}
              </span>
              <h1 style={{ margin: 0, fontSize: '1.8rem', color: 'var(--primary-color)' }}>
                {activeModule.name}
              </h1>
            </div>
            
            <div style={{ flex: 1, padding: '20px 0' }}>
              {(() => {
                const moduleType = activeModule.type?.replace(/"/g, '').trim();

                if (activeModule.category === 'tarea' || moduleType === 'assign') return <TaskView module={activeModule} />;
                if (moduleType === 'forum') return <ForumView forumId={activeModule.instanceId || activeModule.id} />;
                if (moduleType === 'lesson' || moduleType === 'quiz' || activeModule.category === 'test') return <ExamView module={activeModule} courseId={parseInt(id!)} />;

                if (moduleType === 'label' || moduleType === 'page') {
                  let htmlConToken = activeModule.description || '';
                  if (token && htmlConToken) {
                    htmlConToken = htmlConToken.replace(
                      /(https?:\/\/[^"'\s]*?pluginfile\.php\/[^"'\s]*?)(?=["'\s])/g,
                      (match) => {
                        const cleanUrl = match.replace('webservice/pluginfile.php', 'pluginfile.php').replace(/[?&]forcedownload=1/g, '');
                        return `http://localhost:3000/files/proxy?url=${encodeURIComponent(cleanUrl)}&token=${token}`;
                      }
                    );
                    htmlConToken = htmlConToken.replace(
                      /<a[^>]*href="https?:\/\/(?:www\.)?(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|\S*?[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})"[^>]*>.*?<\/a>/gi,
                      '<div style="position:relative; padding-bottom:56.25%; height:0; margin: 20px 0; border-radius: 12px; overflow: hidden;"><iframe style="position:absolute; top:0; left:0; width:100%; height:100%; border:0;" src="https://www.youtube.com/embed/$1" allowfullscreen></iframe></div>'
                    );
                  }
                  return htmlConToken ? (
                    <div className="html-content-render" dangerouslySetInnerHTML={{ __html: htmlConToken }} />
                  ) : (
                    <p style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Este apartado no tiene contenido.</p>
                  );
                }

                if (moduleType === 'resource') {
                  const safeFileUrl = activeModule.fileUrl?.trim();
                  if (safeFileUrl) {
                    const cleanUrl = safeFileUrl.replace('webservice/pluginfile.php', 'pluginfile.php').replace(/[?&]forcedownload=1/g, '');
                    return (
                      <iframe
                        src={`http://localhost:3000/files/proxy?url=${encodeURIComponent(cleanUrl)}&token=${token}`}
                        title={activeModule.name}
                        style={{ width: '100%', height: '70vh', minHeight: '500px', border: '1px solid var(--border-color)', borderRadius: '12px' }}
                        allowFullScreen
                      />
                    );
                  }
                }
                return <p className="page-description">Contenido didáctico: {activeModule.name}</p>;
              })()}
            </div>

            {(() => {
              const moduleType = activeModule.type?.replace(/"/g, '').trim();
              const isManualModule = moduleType !== 'forum' && moduleType !== 'lesson' && moduleType !== 'quiz' && activeModule.category !== 'test';
              const isCompleted = completedModuleIds.includes(activeModule.id);

              if (!isManualModule) return null;

              return (
                <div style={{ marginTop: 'auto', paddingTop: '30px', borderTop: '1px solid var(--border-color)', textAlign: 'right' }}>
                  {isCompleted ? (
                    <div className="success-badge">✅ Lección completada</div>
                  ) : (
                    <button 
                      className="btn-success"
                      onClick={handleMarkAsCompleted}
                      disabled={markingId === activeModule.id}
                    >
                      {markingId === activeModule.id ? 'Guardando...' : 'Marcar como terminado ✓'}
                    </button>
                  )}
                </div>
              );
            })()}

          </div>
        ) : (
          <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
            <p>Seleccioná una lección del menú izquierdo para comenzar.</p>
          </div>
        )}
      </main>
    </div>
  );
};