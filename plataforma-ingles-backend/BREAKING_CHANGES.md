# Breaking changes — Backend hardening (P0–P2)

Documentación de contratos rotos para adaptar `plataforma-ingles-frontend`.

## Auth

- Casi todos los endpoints de alumno/profesor requieren `Authorization: Bearer <moodle_wstoken>` válido (validado contra Moodle, no solo presente).
- Nuevo guard interno: `MoodleAuthGuard`. Admin sigue con header `x-admin-key` (`ADMIN_SECRET`).

## Endpoints

| Antes | Ahora |
|-------|--------|
| `POST /exams/:id/submit` con `{ userId, answers }` | Solo `{ answers }`; `userId` sale del token |
| `GET /exams/:id/attempts/:userId` abierto | Alumno: `GET /exams/:id/attempts` (sus intentos). Admin: `GET /exams/:id/attempts/:userId` + `x-admin-key` |
| `GET /exams/:id` con `isCorrect` en opciones | Sin `isCorrect`; incluye `maxAttempts` / `passThreshold` |
| `GET /users/buscar` sin auth | Requiere `x-admin-key` |
| `GET /courses`, `/courses/tree`, `/courses/:id/contents` token opcional | Bearer obligatorio; sin fallback al catálogo completo |
| `GET /lessons/:id/pages`, `GET /tasks/:assignId` sin auth | Bearer obligatorio |
| `POST /lessons/:id/submit` / tasks con `token` en body | Token solo por header Bearer |
| `GET /recordings*` con Bearer no validado | Bearer validado contra Moodle |

## Attendance (por aula / turno)

Asistencia deja de usar cursos Moodle. Unidad = `ScheduleShift` (aula). Solo el profesor marca presente/ausente.

| Antes | Ahora |
|-------|--------|
| `GET /attendance/teacher/courses` | `GET /attendance/teacher/shifts` |
| `GET /attendance/teacher/sessions?courseId=` | `GET /attendance/teacher/sessions?shiftId=` |
| `POST /attendance/sessions` con `{ moodleCourseId }` | `{ shiftId, sessionDate?, title?, open? }` |
| `GET /attendance/open` (check-in alumno) | Eliminado |
| `POST /attendance/sessions/:id/check-in` | Eliminado |
| Roster = todos los enrolled Moodle del curso | Roster = `shift_enrollments` del turno |
| — | `PATCH /attendance/sessions/:id/roster/:moodleUserId` con `{ present: boolean }` |
| — | Admin: `GET/POST/DELETE /calendar/admin/shifts/:id/teachers` |

Permisos de profesor sobre un turno: solo si está en `shift_teachers` (ya no se infiere por rol teacher en Moodle).

`GET /attendance/me` historial del alumno (solo lectura): sesiones **cerradas** de sus turnos, con `status: present | absent`, fecha y nombre de aula/programa.

Al cerrar una sesión, los alumnos sin marca quedan registrados como `absent`. Marcar roster solo si la sesión está `open`.

## Matrícula masiva programa/aula → Moodle

Al asignar un **alumno** o **profesor** a un aula (`/calendar/admin/shifts/:id/enrollments|teachers`), Hopee lo matricula automáticamente en Moodle en **todos los cursos** linkeados a la carpeta del turno y sus subcarpetas (`enrol_manual_enrol_users` con `MOODLE_TOKEN`).

Al quitarlo del aula, se desmatricula en Moodle solo si ya no pertenece a otro turno del mismo árbol de carpeta.

Al linkear un curso Moodle a una carpeta (`POST /courses/admin/folders/:id/courses`), se matricula a los miembros actuales de los turnos afectados en ese curso.

Requisitos Moodle:

- Método de matrícula **Manual** habilitado en los cursos.
- WS del servicio: `enrol_manual_enrol_users`, `enrol_manual_unenrol_users`.
- Roles: `MOODLE_STUDENT_ROLE_ID` (default 5), `MOODLE_TEACHER_ROLE_ID` (default 3).

Crear cursos Moodle desde Hopee: **fuera de alcance** (después).

## Exams

- Máximo de intentos por defecto: **3** (`maxAttempts` en create/update admin).
- Umbral de aprobación por defecto: **60** (`passThreshold`).
- Preguntas sin responder cuentan como incorrectas en el score.

## Base de datos

- `DB_SYNC` default **`false`**. No usar synchronize en producción.
- Correr migrations:

```bash
npm run migration:run
```

- Scripts: `migration:generate`, `migration:run`, `migration:revert`.
- Nueva migración: `1741000000000-AttendanceByShiftAndTeachers` (`shift_teachers`, `attendance_sessions.shiftId`, `markedByUserId`). **Borra sesiones de asistencia legacy** sin `shiftId`.

## Variables de entorno nuevas / relevantes

| Variable | Descripción |
|----------|-------------|
| `CORS_ORIGINS` | Lista separada por comas. Si vacío, CORS deniega origins (no refleja cualquiera). |
| `APP_TZ` | Timezone fechas asistencia/microlearning (default `America/Guayaquil`). |
| `DB_SYNC` | Solo `true` en local extremo; preferir migrations. |
| `ADMIN_SECRET` | Obligatorio para rutas admin; vacío = deny. |
| `MOODLE_STUDENT_ROLE_ID` | Role id Moodle alumno (default `5`). |
| `MOODLE_TEACHER_ROLE_ID` | Role id Moodle profesor editingteacher (default `3`). |

Autocomplete de usuarios en admin: `GET /users/search?q=` carga el directorio Moodle en cache (~10 min) con `core_user_get_users` (comodín) y filtra en memoria; al asignar se envía el `moodleUserId` como siempre.

## Exámenes (tipos y media)

- Preguntas: `multiple_choice` | `true_false` | `gap_fill`; campos `imageUrl`, `audioUrl`, `wordBank`, `correctBlanks`.
- Media: subir archivo con `POST /exams/admin/media` (admin); servir con `GET /exams/media/:filename`. Paths guardados como `/exams/media/<uuid>.ext` (ya no URLs externas en admin).
- Alumno: `GET /exams/mine` lista exámenes activos de sus cursos Moodle (status `pending` | `failed` | `passed` | `exhausted`).
- Profesor (asignado al aula): `GET /exams/teacher/shifts` y `GET /exams/teacher/shifts/:shiftId/grades` — tabla alumnos × exámenes del árbol de carpetas del turno (mejor nota / intentos).
- Migración: `1742000000000-ExamQuestionTypesMedia`.
- Submit `answers`: MC/TF → `optionId`; gap_fill → `{ "1": "word", ... }`.

Los profesores **ya no** pueden enrolar/desenrolar alumnos vía `/calendar/teacher/shifts/.../enrollments` (solo admin).

## Login

- Credenciales hacia Moodle `token.php` van por **POST** form-urlencoded (ya no en query string).
