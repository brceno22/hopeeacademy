import React from 'react';
import {
  extractBlankKeys,
  resolveExamMediaUrl,
  type Option,
  type Question,
  type QuestionType,
} from './adminExams';

interface QuestionEditorProps {
  q: Question;
  qi: number;
  questionsCount: number;
  distractorDraft: Record<number, string>;
  setDistractorDraft: React.Dispatch<React.SetStateAction<Record<number, string>>>;
  mediaUploading: string | null;
  onRemove: (qi: number) => void;
  onUpdateQuestion: (qi: number, field: keyof Question, value: Question[keyof Question]) => void;
  onSetQuestionType: (qi: number, type: QuestionType) => void;
  onUpdateOption: (qi: number, oi: number, field: keyof Option, value: Option[keyof Option]) => void;
  onUploadMedia: (qi: number, field: 'imageUrl' | 'audioUrl', file: File | null) => void;
  onChangeText: (qi: number, text: string) => void;
  onSyncGapWordBank: (qi: number, correctBlanks: Record<string, string>, extra: string[]) => void;
}

export const QuestionEditor: React.FC<QuestionEditorProps> = ({
  q,
  qi,
  questionsCount,
  distractorDraft,
  setDistractorDraft,
  mediaUploading,
  onRemove,
  onUpdateQuestion,
  onSetQuestionType,
  onUpdateOption,
  onUploadMedia,
  onChangeText,
  onSyncGapWordBank,
}) => {
  const blanks = extractBlankKeys(q.text || '');
  const distractors = (q.wordBank || []).filter(
    (w) =>
      !Object.values(q.correctBlanks || {})
        .map((x) => x.trim().toLowerCase())
        .includes(w.trim().toLowerCase()),
  );

  return (
    <div className="admin-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
        <h4 style={{ margin: 0 }}>Question {qi + 1}</h4>
        {questionsCount > 1 && (
          <button type="button" className="admin-btn ghost" onClick={() => onRemove(qi)}>
            Delete
          </button>
        )}
      </div>

      <label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>Type</label>
      <select
        className="admin-select"
        style={{ width: '100%', marginBottom: 12 }}
        value={q.type || 'multiple_choice'}
        onChange={(e) => onSetQuestionType(qi, e.target.value as QuestionType)}
      >
        <option value="multiple_choice">Multiple choice</option>
        <option value="true_false">True / False</option>
        <option value="gap_fill">Gap fill (word bank)</option>
      </select>

      <label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>
        {q.type === 'gap_fill' ? 'Sentence (use {{1}}, {{2}}, …)' : 'Prompt'}
      </label>
      <textarea
        className="admin-input"
        style={{
          width: '100%',
          boxSizing: 'border-box',
          marginBottom: 12,
          minHeight: 72,
          fontFamily: 'inherit',
        }}
        value={q.text}
        onChange={(e) => onChangeText(qi, e.target.value)}
        placeholder={
          q.type === 'gap_fill' ? 'They {{1}} happy and she {{2}} tall.' : 'Write the question'
        }
      />

      <div style={{ marginBottom: 12 }}>
        <label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>Image (optional)</label>
        {q.imageUrl ? (
          <div style={{ marginBottom: 8 }}>
            <img
              src={resolveExamMediaUrl(q.imageUrl) || ''}
              alt=""
              style={{ maxWidth: 240, maxHeight: 140, borderRadius: 8, border: '1px solid #ddd' }}
            />
            <div style={{ marginTop: 6 }}>
              <button
                type="button"
                className="admin-btn ghost"
                onClick={() => onUpdateQuestion(qi, 'imageUrl', '')}
              >
                Remove image
              </button>
            </div>
          </div>
        ) : null}
        <input
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp"
          disabled={mediaUploading === `${qi}-imageUrl`}
          onChange={(e) => {
            const f = e.target.files?.[0] || null;
            e.target.value = '';
            void onUploadMedia(qi, 'imageUrl', f);
          }}
        />
        {mediaUploading === `${qi}-imageUrl` && (
          <span className="page-description"> Uploading…</span>
        )}
      </div>

      <div style={{ marginBottom: 12 }}>
        <label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>Audio (optional)</label>
        {q.audioUrl ? (
          <div style={{ marginBottom: 8 }}>
            <audio controls src={resolveExamMediaUrl(q.audioUrl) || ''} style={{ width: '100%' }} />
            <div style={{ marginTop: 6 }}>
              <button
                type="button"
                className="admin-btn ghost"
                onClick={() => onUpdateQuestion(qi, 'audioUrl', '')}
              >
                Remove audio
              </button>
            </div>
          </div>
        ) : null}
        <input
          type="file"
          accept="audio/mpeg,audio/mp4,audio/wav,audio/ogg,audio/webm,.mp3,.m4a,.wav,.ogg"
          disabled={mediaUploading === `${qi}-audioUrl`}
          onChange={(e) => {
            const f = e.target.files?.[0] || null;
            e.target.value = '';
            void onUploadMedia(qi, 'audioUrl', f);
          }}
        />
        {mediaUploading === `${qi}-audioUrl` && (
          <span className="page-description"> Uploading…</span>
        )}
      </div>

      {q.type === 'true_false' && (
        <>
          <label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>Correct answer</label>
          {(q.options || []).map((opt, oi) => (
            <label
              key={oi}
              style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}
            >
              <input
                type="radio"
                name={`correct-${qi}`}
                checked={opt.isCorrect}
                onChange={() => onUpdateOption(qi, oi, 'isCorrect', true)}
              />
              {opt.text}
            </label>
          ))}
        </>
      )}

      {q.type === 'multiple_choice' && (
        <>
          <label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>
            Options (mark the correct one)
          </label>
          {q.options.map((opt, oi) => (
            <div key={oi} className="admin-form-row" style={{ marginBottom: 8 }}>
              <input
                type="radio"
                name={`correct-${qi}`}
                checked={opt.isCorrect}
                onChange={() => onUpdateOption(qi, oi, 'isCorrect', true)}
              />
              <input
                className="admin-input"
                style={{ flex: 1, minWidth: 0 }}
                value={opt.text}
                onChange={(e) => onUpdateOption(qi, oi, 'text', e.target.value)}
                placeholder={`Option ${oi + 1}`}
              />
            </div>
          ))}
        </>
      )}

      {q.type === 'gap_fill' && (
        <>
          <label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>
            Correct words per blank
          </label>
          {blanks.length === 0 ? (
            <p className="page-description">Add blanks like {'{{1}}'} in the sentence.</p>
          ) : (
            blanks.map((key) => (
              <div key={key} className="admin-form-row" style={{ marginBottom: 8 }}>
                <span style={{ minWidth: 48, fontWeight: 600 }}>{`{{${key}}}`}</span>
                <input
                  className="admin-input"
                  style={{ flex: 1 }}
                  value={q.correctBlanks?.[key] || ''}
                  onChange={(e) => {
                    const next = { ...(q.correctBlanks || {}), [key]: e.target.value };
                    onUpdateQuestion(qi, 'correctBlanks', next);
                    onSyncGapWordBank(qi, next, distractors);
                  }}
                  placeholder="Correct word"
                />
              </div>
            ))
          )}
          <label style={{ display: 'block', fontWeight: 600, marginBottom: 6, marginTop: 12 }}>
            Extra words in the box (distractors)
          </label>
          <div className="admin-form-row" style={{ marginBottom: 8 }}>
            <input
              className="admin-input"
              style={{ flex: 1 }}
              value={distractorDraft[qi] || ''}
              onChange={(e) => setDistractorDraft((d) => ({ ...d, [qi]: e.target.value }))}
              placeholder="e.g. am"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  const w = (distractorDraft[qi] || '').trim();
                  if (!w) return;
                  onSyncGapWordBank(qi, q.correctBlanks || {}, [...distractors, w]);
                  setDistractorDraft((d) => ({ ...d, [qi]: '' }));
                }
              }}
            />
            <button
              type="button"
              className="admin-btn muted"
              onClick={() => {
                const w = (distractorDraft[qi] || '').trim();
                if (!w) return;
                onSyncGapWordBank(qi, q.correctBlanks || {}, [...distractors, w]);
                setDistractorDraft((d) => ({ ...d, [qi]: '' }));
              }}
            >
              Add
            </button>
          </div>
          <p className="page-description" style={{ margin: 0 }}>
            Word bank: {(q.wordBank || []).join(', ') || '—'}
          </p>
        </>
      )}
    </div>
  );
};
