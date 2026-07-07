import React, { useState } from 'react';
import api from '@/core/api/axios';

export const AdminMicrolearning: React.FC = () => {
  const [content, setContent] = useState({ title: '', type: 'vocabulary', content: '', translation: '', scheduledFor: '' });

  const handleManualSubmit = async () => {
    try {
      await api.post('/microlearning/admin/create', content);
      alert('¡Guardado correctamente!');
    } catch (e) { alert('Error al guardar'); }
  };

  const handleBulkUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        await api.post('/microlearning/admin/bulk', data);
        alert('Carga masiva exitosa');
      } catch (e) { alert('Error en el formato JSON'); }
    };
    reader.readAsText(file);
  };

  return (
    <div style={{ padding: '40px' }}>
      <h1>Panel de Control: Microlearning</h1>
      
      <div style={{ marginBottom: '40px' }}>
        <h3>Carga Manual</h3>
        <input placeholder="Título" onChange={(e) => setContent({...content, title: e.target.value})} style={{ display: 'block', marginBottom: '10px' }} />
        <select onChange={(e) => setContent({...content, type: e.target.value})} style={{ display: 'block', marginBottom: '10px' }}>
          <option value="vocabulary">Vocabulario</option>
          <option value="phrasal_verb">Phrasal Verb</option>
          <option value="audio">Audio</option>
        </select>
        <textarea placeholder="Contenido (ej: Look forward to)" onChange={(e) => setContent({...content, content: e.target.value})} style={{ display: 'block', marginBottom: '10px' }} />
        <input type="date" onChange={(e) => setContent({...content, scheduledFor: e.target.value})} style={{ display: 'block', marginBottom: '10px' }} />
        <button onClick={handleManualSubmit}>Guardar Píldora</button>
      </div>

      <hr />

      <div>
        <h3>Carga Masiva (JSON)</h3>
        <input type="file" accept=".json" onChange={handleBulkUpload} />
      </div>
    </div>
  );
};