# Architecture Discovery & Implementation Plan: Issue #146 (Revised)

## 1. Existing AI Architecture & Shared Client
The repository currently duplicates `GoogleGenAI` instantiation across multiple files.
For #146, we will introduce a shared `utils/aiClient.js` that provides a standardized interface for Gemini (e.g., `generateJsonWithRetry`). It will include strict schema validation and a 1-attempt repair/retry mechanism before failing gracefully. We will NOT redesign the existing #73 (NVIDIA chat) or #34 (Recommendations) flows, strictly adhering to the scope of #146. 
*Constraint:* No internal chain-of-thought (`internal_reasoning`) will be requested, stored, or returned.

## 2. Resume Infrastructure
We will NOT create a duplicate resume upload system. The workflow relies purely on the existing `User.resumeVersions` array.
*Flow:* Candidate uses the existing uploader (which parses PDF/DOCX and stores `text`) -> Candidate selects a `resumeVersion` ID for the Mock Interview / Problem Generator -> Backend verifies ownership against `req.user._id` -> Backend extracts the pre-parsed `text` to feed the Gemini prompt.

## 3. Mock Interview Architecture

### Controlled Question Blueprint Strategy
Instead of arbitrary question generation, interviews are driven by structured blueprints containing topics and constraints mapped to the `role`, `experienceLevel`, and `interviewType`. The AI generates questions within these topical boundaries.

### Data Model: `MockInterviewSession`
```javascript
const mockInterviewSessionSchema = new mongoose.Schema({
  candidate: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  role: { type: String, required: true },
  experienceLevel: { type: String, enum: ['Entry', 'Mid', 'Senior'], required: true },
  interviewType: { type: String, enum: ['Technical', 'Behavioral', 'System Design', 'Resume Deep-Dive'] },
  mode: { type: String, enum: ['Timed', 'Self-Paced'] },
  resumeReference: { type: mongoose.Schema.Types.ObjectId }, 
  status: { type: String, enum: ['Setup', 'In Progress', 'Completed', 'Abandoned'], default: 'Setup' },
  transcript: [{
      turnId: Number,
      question: String,
      candidateAnswer: String,
      hintUsed: { type: Boolean, default: false },
      reframed: { type: Boolean, default: false },
      durationSeconds: Number,
      timestamp: Date
  }],
  evaluation: {
      overallScore: Number,
      strengths: [String],
      improvements: [String],
      dimensionScores: { type: Map, of: Number }, // Dynamic by interview type
      feedback: String
  },
  usage: {
      turns: { type: Number, default: 0 },
      hints: { type: Number, default: 0 },
      reframes: { type: Number, default: 0 }
  }
}, { timestamps: true });
// Index for history lookups
mockInterviewSessionSchema.index({ candidate: 1, createdAt: -1 });
```

### Session Lifecycle & Limits
- **Limits:** Max 10 turns, 3 hints, 3 reframes per session. Max 3 sessions per day (checked via DB). Problem sets: Max 5 generations/day.
- **Lifecycle:** If a candidate leaves and returns, they can resume an `In Progress` session. Starting a new session forces any existing `In Progress` session to `Abandoned`.

## 4. AI Protocols & Validations
- **Strict Validation:** AI responses are validated. If a required field (e.g. `action`, `question`) is missing or invalid, we trigger exactly *one* repair retry. If it fails again, we return a safe task-specific fallback or gracefully fail the request without crashing the app.
- **Reframing:** `POST /interview/session/:id/reframe` asks the AI to rephrase the *current* question. It does NOT increment the turn counter or expect an answer; it simply updates the UI and sets `reframed: true`.

## 5. Interview-Type Evaluation Dimensions
Evaluations are strictly tailored:
- *Technical:* Code Quality, Problem Solving, Optimization.
- *Behavioral:* STAR Structuring, Leadership, Conflict Resolution.
- *System Design:* Scalability, Fault Tolerance, Component Architecture.
- *Resume Deep-Dive:* Experience Depth, Impact Articulation, Authenticity.

## 6. Voice & Video Strategy
- **Text:** Fully independent base experience.
- **Voice:** Browser SpeechRecognition API for input. We will use the Web Audio API to observe basic mechanical delivery metrics (WPM, pauses, speaking duration, volume variation). *Limitation:* Tone/emotion inference is explicitly unsupported as it cannot be done reliably via native browser APIs.
- **Video:** Local `getUserMedia` mirror only. No server uploads.

## 7. Resume Problem Generator

### Data Model: `ResumeProblemSet`
```javascript
const resumeProblemSetSchema = new mongoose.Schema({
  candidate: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  sourceResumeId: { type: mongoose.Schema.Types.ObjectId, required: true },
  problems: [{
      title: String,
      scenario: String,
      constraints: [String],
      objective: String,
      difficulty: String,
      relevantResumeEvidence: String,
      targetedQuestions: [String],
      candidateSolution: String,
      submittedAt: Date
  }]
}, { timestamps: true });
resumeProblemSetSchema.index({ candidate: 1, createdAt: -1 });
```

## 8. Implementation Sequence (Code Execution)
1. Write `utils/aiClient.js` (Isolated GenAI wrapper with schema/retry support).
2. Create `models/MockInterviewSession.js` and `models/ResumeProblemSet.js`.
3. Create `routes/interview.js` and `routes/problems.js`. Hook into `index.js`.
4. Build `views/interview/*` and `views/problems/*`.
5. Ensure 100% strict verification of `req.user._id` for all models.
