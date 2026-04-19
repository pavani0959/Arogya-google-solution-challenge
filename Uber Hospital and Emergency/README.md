# ResQMed (Unified) — Uber for Hospitals + Emergency SOS

This repo is the unified project combining the best of both prototypes into a single **Firebase-first** platform:

- **Care mode**: Specialty → Doctor → Hospital → Slot → Appointment
- **Health Vault**: Upload/view prescriptions and reports
- **SOS mode**: Victim/Helper tabs, simulated crash detection + 10s cancel, helper tracking + points-by-effort (MVP demo)
- **AI assistant**: Server-side endpoint stubbed via Firebase Cloud Functions (no API keys in the browser)

## Quick start (UI-only demo)

```bash
npm install
npm run dev
```

The app runs even without Firebase configured (some features use local demo storage).

## Configure Firebase (recommended)

1. Create a Firebase project.
2. Enable:
   - **Authentication** (Email/Password + optionally Google)
   - **Firestore**
   - **Storage**
3. Copy `.env.example` → `.env.local` and fill in your Firebase web app config.

## Deploy Cloud Functions (AI proxy)

1. Install Firebase CLI and login:

```bash
npm i -g firebase-tools
firebase login
```

2. From the repo root:

```bash
firebase init
```

When prompted, select **Functions**, **Firestore**, **Storage**, **Hosting** (use existing files where applicable).

3. Install functions dependencies:

```bash
cd functions
npm install
```

4. Set secrets (example):

- Set `GEMINI_API_KEY` in your environment for Functions.
  - For production, prefer Google Secret Manager or Firebase environment config.

5. Deploy:

```bash
firebase deploy --only functions
```

## Firestore / Storage rules

- Firestore: `firestore.rules`
- Storage: `storage.rules`
- Schema notes: `docs/firebase-schema.md`

## Docs

- Feature matrix: `docs/feature-matrix.md`
- Firebase schema: `docs/firebase-schema.md`
- UI system: `docs/ui-design-system.md`

