# Student Skill Assistant – MVP Plan

## 1. Tech Stack & Architecture
- **Backend**: FastAPI (existing server.py), Motor (MongoDB async client), JWT auth
- **Frontend**: React 19 (CRA + craco), React Router v7, axios, shadcn/ui components, Tailwind
- **DB**: MongoDB via `MONGO_URL` and `DB_NAME` from backend `.env`
- **API base**: All routes under `/api` (already have `api_router` prefix)
- **Frontend API URL**: `process.env.REACT_APP_BACKEND_URL + '/api'`

## 2. Data Model (MongoDB Collections)

### students
- `_id` (ObjectId)
- `name` (str)
- `email` (str, unique)
- `password_hash` (str, bcrypt)
- `branch` (str)
- `semester` (int or str)
- `created_at` (datetime ISO string)

### test_results
- `_id` (ObjectId)
- `student_id` (ObjectId ref → students)
- `track` ("webdev" | "ml")
- `score` (int)
- `total` (int)
- `percentage` (float)
- `level` ("Beginner" | "Intermediate" | "Advanced")
- `submitted_at` (datetime ISO string)

Questions, docs, and courses will be static in code (Python or JS objects) – no collections.

## 3. Auth Design (JWT)

- **Register**: `POST /api/auth/register`
  - Body: `{ name, email, password, branch, semester }`
  - Hash password with bcrypt
  - Fail if email already exists
  - Return: `{ message, student: { id, name, email, branch, semester } }`

- **Login**: `POST /api/auth/login`
  - Body: `{ email, password }`
  - Verify using bcrypt
  - If OK, create JWT with fields: `sub` (student_id), `email`
  - Sign with secret from backend `.env` (e.g., `JWT_SECRET`, `JWT_ALGORITHM=HS256`, `JWT_EXPIRES_MINUTES`)
  - Return `{ access_token, token_type: "bearer", student: { id, name, email, branch, semester } }`

- **Token verification dependency** for protected endpoints
  - Auth header: `Authorization: Bearer <token>`
  - If invalid/expired, 401
  - Provides `current_student` in route handler (id + basic fields)

Frontend stores token in **localStorage** and attaches via axios interceptor.

## 4. Feature API Design

### Health / root
- Keep existing `GET /api/` for health check.

### Tests
- Static questions defined in backend (Python list of dicts) for each track.

- **Get questions**: `GET /api/tests/{track}`
  - `track` in ["webdev", "ml"]
  - Returns: `{ track, questions: [{ id, question, options: [..] }] }` (no correct answers)

- **Submit answers**: `POST /api/tests/{track}` (protected)
  - Body: `{ answers: [{ questionId, optionIndex }] }`
  - Backend uses internal question bank (with correctIndex) to compute score.
  - Determine level from percentage:
    - 0–40 → `Beginner`
    - 41–75 → `Intermediate`
    - 76–100 → `Advanced`
  - Save `test_results` doc for student.
  - Return `{ score, total, percentage, level, message }`.

- **Get latest levels**: `GET /api/tests/levels` (protected)
  - For current student, find most recent `test_results` per track.
  - Return: `{ webdev: { level, percentage } | null, ml: { level, percentage } | null }`.

### Course Recommendations
- Static course list in backend.
- **GET /api/recommendations** (protected)
  - Use latest levels per track (or treat missing as Beginner).
  - Filter static courses by `track` and `difficulty`.
  - Return: `{ webdev: Course[], ml: Course[] }` where `Course = { id, title, platform, url, difficulty }`.

### Docs
- Static docs list in backend (or frontend). For consistency and single source, we’ll serve via backend.
- **GET /api/docs`**
  - Return nested structure:
    ```json
    {
      "categories": [
        {
          "id": "webdev",
          "title": "Web Development",
          "items": [
            { "id": "html-basics", "title": "HTML Basics", "track": "webdev", "content": "...", "code": "..." },
            ...
          ]
        },
        {
          "id": "ml",
          "title": "Machine Learning",
          "items": [ ... ]
        }
      ]
    }
    ```

### Chat Assistant (dummy)
- **POST /api/chat`** (protected)
  - Body: `{ message: string }`
  - Logic:
    - if "html" in message.lower(): reply with simple HTML explanation
    - elif "css" / "javascript" / "ml" / "machine learning" appear → custom quick answers
    - else default generic message
  - Return: `{ reply }`.

## 5. Frontend Pages & Flows

### Global
- Use a layout with top navbar: app name "Student Skill Assistant" and right side user info / logout when logged in.
- Use React Router routes:
  - `/register`
  - `/login`
  - `/dashboard`
  - `/tests/webdev`
  - `/tests/ml`
  - `/tests/result/:track` (show last submission for that track from navigation state)
  - `/recommendations`
  - `/docs`
  - `/chat`
- Implement `RequireAuth` wrapper that checks localStorage for token; if missing, redirect to `/login`.
- Context or simple hook to hold current student info in memory; initialize from localStorage on app start.

### Components & UI
- Use shadcn components: `button`, `card`, `input`, `label`, `tabs`, `textarea`, `scroll-area`, `badge`, `alert`.
- Overall styling:
  - Clean light theme, subtle shadows, card-based sections.
  - Left-aligned content (no global text-align center on `.App`).
  - Use Tailwind for layout and spacing.

- **data-testid**: Add unique test IDs on all interactive and key content elements (buttons, inputs, cards, messages, etc.).

### /register
- Card-centered form (but page content left-aligned overall, only the card centered in viewport).
- Fields: name, email, password, branch, semester.
- Client-side required validation.
- On success → toast + redirect to `/login`.

### /login
- Email + password form.
- On success: save token + student in localStorage, redirect `/dashboard`.

### /dashboard
- Fetch `/api/tests/levels` on load.
- Show welcome text: "Welcome, {studentName}".
- Show two cards: Web Dev & ML, each showing current level or "Not evaluated yet".
- Buttons for:
  - Take Web Dev Test (/tests/webdev)
  - Take ML Test (/tests/ml)
  - View Course Recommendations (/recommendations)
  - Open Docs (/docs)
  - Open Chat Assistant (/chat)

### Test pages
- `/tests/webdev` and `/tests/ml` fetch questions via `GET /api/tests/{track}`.
- Render all questions with 4 radio options.
- Ensure each option and question has `data-testid`.
- On submit, `POST /api/tests/{track}` with selected answers.
- On response, navigate to `/tests/result/{track}` with state including result.

### Test result page
- Displays:
  - Score, total, percentage, level.
  - Short message by level.
  - Buttons: Back to Dashboard, View Recommendations.

### Recommendations page
- Calls `GET /api/recommendations`.
- Show two sections with headings.
- Each course as card with title, platform, difficulty badge, and "Open Course" link button.

### Docs page
- Fetch `/api/docs` once.
- Left sidebar list of items grouped by category.
- Right panel shows selected doc.
- Display title, text paragraphs, and optional code block using `<pre><code>`.

### Chat page
- Simple two-column card: chat history above, input + "Send" button below.
- Messages styled differently for user and assistant.
- `POST /api/chat` on send, append reply to history.

## 6. Error Handling & UX
- Use toast notifications for success/error via existing `use-toast` hook & `Toaster` component.
- Show loading states for main pages (spinners or skeleton text).
- Handle 401 globally: if axios gets 401, clear localStorage and redirect to `/login`.

## 7. Implementation Steps

1. **Backend**
   - Replace `server.py` content with modularized FastAPI app inside the same file for simplicity: models, auth utilities, routers.
   - Implement:
     - JWT utils and auth dependency
     - `/auth/register`, `/auth/login`
     - `/tests/{track}` (GET + POST)
     - `/tests/levels`
     - `/recommendations`
     - `/docs`
     - `/chat`
   - Keep existing CORS and `/api/` root endpoint.
   - Run python lint (ruff) after changes.

2. **Frontend**
   - Replace `App.js` with router-based layout and pages.
   - Add components/pages under `src/` (can define inline in App.js for MVP but better to split into small logical components in same file to respect bulk write step).
   - Configure axios instance with baseURL and interceptors.
   - Add global context for auth (current student + token).
   - Ensure every interactive element has `data-testid`.
   - Run ESLint check.

3. **Testing & Polish**
   - Run `esbuild src/ --loader:.js=jsx --bundle --outfile=/dev/null` to catch build issues.
   - Use screenshot tool to visually inspect main flows.
   - Call testing_agent_v3 with details for end-to-end testing (auth, tests, recommendations, docs, chat).
   - Fix any bugs found.

## 8. Notes
- All data other than students and test_results is **hardcoded** in backend code.
- Auth is JWT-only; no refresh tokens to keep it simple.
- This is an MVP but with a clean, modern, minimal dashboard UX.