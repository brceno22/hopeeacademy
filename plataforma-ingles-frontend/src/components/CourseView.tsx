import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { TaskView } from './TaskView';
import { ExamView } from './ExamView';

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

  useEffect(() => {
    const fetchContents = async () => {
      try {
        const [contentsRes, examsRes] = await Promise.all([
          api.get(`/courses/${id}/contents`),
          api.get(`/exams/course/${id}`),
        ]);
        setSections(contentsRes.data);
        setExamenes(examsRes.data);

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

  if (loading) return <div style={{ padding: '20px' }}>Cargando lecciones...</div>;

  return (
    <div style={{ display: 'flex', height: '100vh', fontFamily: 'system-ui' }}>
      
      {/* COLUMNA IZQUIERDA */}
      <div style={{ width: '25%', background: '#f8f9fa', borderRight: '1px solid #ddd', padding: '20px', overflowY: 'auto' }}>
        <button 
          onClick={() => navigate('/app/cursos')}
          style={{ marginBottom: '20px', padding: '8px', background: 'transparent', border: '1px solid #ccc', borderRadius: '4px', cursor: 'pointer' }}
        >
          ⬅ Volver al Panel
        </button>
        
        <h3 style={{ marginTop: 0 }}>Índice del Curso</h3>

        {sections.map((section) => (
          <div key={section.id} style={{ marginBottom: '15px' }}>
            <h4 style={{ margin: '0 0 10px 0', color: '#333' }}>{section.name}</h4>
            {section.modules.filter(mod => {
              const t = mod.type?.replace(/"/g, '').trim();
              return t !== 'lesson' && t !== 'quiz';
            }).length === 0 ? (
              <p style={{ fontSize: '12px', color: '#999', margin: 0 }}>Sin contenido</p>
            ) : (
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {section.modules
                  .filter(mod => {
                    const t = mod.type?.replace(/"/g, '').trim();
                    return t !== 'lesson' && t !== 'quiz';
                  })
                  .map((mod) => (
                    <li key={mod.id} style={{ marginBottom: '5px' }}>
                      <button
                        onClick={() => setActiveModule(mod)}
                        style={{
                          width: '100%',
                          textAlign: 'left',
                          padding: '10px',
                          background: activeModule?.id === mod.id ? '#e3f2fd' : 'white',
                          color: activeModule?.id === mod.id ? '#0d47a1' : '#555',
                          border: '1px solid #eee',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontWeight: activeModule?.id === mod.id ? 'bold' : 'normal',
                        }}
                      >
                        📖 {mod.name}
                      </button>
                    </li>
                  ))}
              </ul>
            )}
          </div>
        ))}

        {/* Sección propia de Exámenes */}
        {examenes.length > 0 && (
          <div style={{ marginBottom: '15px' }}>
            <h4 style={{ margin: '0 0 10px 0', color: '#333' }}>📝 Exámenes</h4>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              <li style={{ marginBottom: '5px' }}>
                <button
                  onClick={() => setActiveModule({
                    id: -1,
                    name: 'Exámenes del Curso',
                    type: 'lesson',
                    category: 'test',
                    description: '',
                    url: '',
                    fileUrl: null,
                  })}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    padding: '10px',
                    background: activeModule?.id === -1 ? '#f3e5f5' : 'white',
                    color: activeModule?.id === -1 ? '#9c27b0' : '#555',
                    border: '1px solid #eee',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontWeight: activeModule?.id === -1 ? 'bold' : 'normal',
                  }}
                >
                  📝 Ver todos los exámenes
                </button>
              </li>
            </ul>
          </div>
        )}
      </div>

      {/* COLUMNA DERECHA */}
      <div style={{ width: '75%', padding: '40px', overflowY: 'auto', background: '#fff' }}>
        {activeModule ? (
          <div style={{ maxWidth: '900px', margin: '0 auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
              <span style={{ background: '#eee', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', textTransform: 'uppercase', fontWeight: 'bold' }}>
                {activeModule.category.replace('_', ' ')}
              </span>
              <h1 style={{ margin: 0, fontSize: '24px' }}>{activeModule.name}</h1>
            </div>
            
            <hr style={{ border: '0', borderTop: '1px solid #eee', marginBottom: '20px' }} />
            
            <div style={{ 
              background: '#fcfcfc', 
              border: '1px solid #ddd', 
              borderRadius: '8px', 
              padding: (activeModule.type === 'label' || activeModule.type === 'page') ? '30px' : '0', 
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column'
            }}>
              {(() => {
                const moduleType = activeModule.type?.replace(/"/g, '').trim();

                // 1. TAREAS
                if (activeModule.category === 'tarea' || moduleType === 'assign') {
                  return <TaskView module={activeModule} />;
                }

                // 2. EXÁMENES / LECCIONES
                if (moduleType === 'lesson' || moduleType === 'quiz' || activeModule.category === 'test') {
                  return <ExamView module={activeModule} courseId={parseInt(id!)} />;
                }

                // 3. TEXTOS Y PÁGINAS
                if (moduleType === 'label' || moduleType === 'page') {
                  let htmlConToken = activeModule.description || '';
                  if (token && htmlConToken) {
                    // Reemplazamos TODAS las URLs de pluginfile por nuestro proxy NestJS
                    htmlConToken = htmlConToken.replace(
                      /(https?:\/\/[^"'\s]*?pluginfile\.php\/[^"'\s]*?)(?=["'\s])/g,
                      (match) => {
                        const cleanUrl = match
                          .replace('webservice/pluginfile.php', 'pluginfile.php')
                          .replace(/[?&]forcedownload=1/g, '');
                        return `http://localhost:3000/files/proxy?url=${encodeURIComponent(cleanUrl)}&token=${token}`;
                      }
                    );

                    // YouTube
                    htmlConToken = htmlConToken.replace(
                      /<a[^>]*href="https?:\/\/(?:www\.)?(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|\S*?[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})"[^>]*>.*?<\/a>/gi,
                      '<div style="position:relative; padding-bottom:56.25%; height:0; margin: 20px 0;"><iframe style="position:absolute; top:0; left:0; width:100%; height:100%; border:0;" src="https://www.youtube.com/embed/$1" allowfullscreen></iframe></div>'
                    );

                    htmlConToken = htmlConToken.replace(/<p><br><\/p>/g, '').replace(/<p>\s*<\/p>/g, '');
                  }
                  return htmlConToken ? (
                    <div style={{ lineHeight: '1.6', fontSize: '16px', color: '#333' }} dangerouslySetInnerHTML={{ __html: htmlConToken }} />
                  ) : (
                    <p style={{ textAlign: 'center', color: '#999', margin: '20px 0' }}>Este apartado no tiene contenido.</p>
                  );
                }

                // 4. ARCHIVOS Y PDFs
                if (moduleType === 'resource') {
                  const safeFileUrl = activeModule.fileUrl?.trim();
                  if (safeFileUrl) {
                    const cleanUrl = safeFileUrl
                      .replace('webservice/pluginfile.php', 'pluginfile.php')
                      .replace(/[?&]forcedownload=1/g, '');

                    const proxyUrl = `http://localhost:3000/files/proxy?url=${encodeURIComponent(cleanUrl)}&token=${token}`;

                    return (
                      <iframe
                        src={proxyUrl}
                        title={activeModule.name}
                        width="100%"
                        style={{ border: 'none', height: '70vh', minHeight: '500px' }}
                        allowFullScreen
                      />
                    );
                  }
                  return (
                    <div style={{ padding: '30px', textAlign: 'center', color: '#999' }}>
                      <p style={{ margin: 0 }}>⚠️ No hay ningún archivo PDF adjunto en esta sección.</p>
                    </div>
                  );
                }

                // 5. FALLBACK
                return (
                  <div style={{ padding: '30px', textAlign: 'center', color: '#999' }}>
                    Contenido didáctico: <strong>{activeModule.name}</strong>.
                  </div>
                );
              })()}
            </div>
          </div>
        ) : (
          <div style={{ textAlign: 'center', marginTop: '100px', color: '#999' }}>
            Seleccioná una lección del menú izquierdo para comenzar.
          </div>
        )}
      </div>
    </div>
  );
};