import cors from 'cors';
import { onRequest } from 'firebase-functions/v2/https';
import * as logger from 'firebase-functions/logger';
import admin from 'firebase-admin';
import { z } from 'zod';

admin.initializeApp();

const corsHandler = cors({ origin: true });

// -------------------------
// Assistant (server-side AI)
// -------------------------

const AssistantRequest = z.object({
  mode: z.enum(['book', 'meds', 'triage', 'sos']).default('triage'),
  message: z.string().min(1),
  context: z
    .object({
      specialty: z.string().optional(),
      location: z.object({ lat: z.number(), lon: z.number() }).optional(),
    })
    .optional(),
});

export const assistant = onRequest({ region: 'asia-south1' }, (req, res) => {
  corsHandler(req, res, async () => {
    try {
      if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
      }

      const parsed = AssistantRequest.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: 'Invalid request', details: parsed.error.flatten() });
        return;
      }

      const { mode, message, context } = parsed.data;
      const geminiKey = process.env.GEMINI_API_KEY;

      // If no key configured, return a deterministic, safe response (so UI works in demo mode).
      if (!geminiKey) {
        res.json({
          reply: demoAssistantReply(mode, message),
          source: 'demo',
        });
        return;
      }

      const prompt = buildAssistantPrompt(mode, message, context);
      const reply = await callGemini(prompt, geminiKey);
      res.json({ reply, source: 'gemini' });
    } catch (err: any) {
      logger.error('assistant error', err);
      res.status(500).json({ error: 'Internal error', message: String(err?.message || err) });
    }
  });
});

function demoAssistantReply(mode: string, message: string) {
  if (mode === 'book') return `Demo booking assistant: I understood “${message}”. Next I’ll ask: specialty, hospital, date/time.`;
  if (mode === 'meds') return `Demo medicine assistant: I understood “${message}”. In production I’ll fetch OpenFDA then summarize safely.`;
  if (mode === 'sos') return `Demo SOS coach: If this is an emergency, call your local emergency number. I can guide first-aid steps next.`;
  return `Demo triage: I understood “${message}”. If severe symptoms (chest pain, breathing trouble, heavy bleeding), use SOS immediately.`;
}

function buildAssistantPrompt(
  mode: 'book' | 'meds' | 'triage' | 'sos',
  message: string,
  context?: { specialty?: string; location?: { lat: number; lon: number } },
) {
  const base =
    'You are ResQMed Assistant. Be concise, safety-first, and non-diagnostic. If user mentions emergency symptoms, recommend SOS / emergency services.';

  const modeGuidance =
    mode === 'book'
      ? 'Goal: help the user book an appointment. Ask for missing details (specialty, doctor/hospital preference, date/time, reason). Output a JSON block at end with extracted fields.'
      : mode === 'meds'
        ? 'Goal: explain medicine info in simple terms. Include: use, how to take, side effects, warnings, when to see a doctor. No prescriptions.'
        : mode === 'sos'
          ? 'Goal: guide user during SOS. Provide step-by-step first aid checklist and calm instructions. Encourage sharing location and calling emergency number.'
          : 'Goal: symptom triage. Do not diagnose; recommend appropriate specialty or SOS. Ask 1-2 key questions only.';

  return [
    base,
    modeGuidance,
    context?.location ? `User location lat=${context.location.lat}, lon=${context.location.lon}` : '',
    context?.specialty ? `Preferred specialty: ${context.specialty}` : '',
    `User: ${message}`,
  ]
    .filter(Boolean)
    .join('\n\n');
}

async function callGemini(prompt: string, apiKey: string) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`;
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.3, maxOutputTokens: 800 },
    }),
  });

  if (!r.ok) {
    const txt = await r.text();
    throw new Error(`Gemini error ${r.status}: ${txt}`);
  }

  const data: any = await r.json();
  return data?.candidates?.[0]?.content?.parts?.[0]?.text || 'No response.';
}

