import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI, Type } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json());

// Initialize GoogleGenAI
const apiKey = process.env.GEMINI_API_KEY;
let ai: GoogleGenAI | null = null;
if (apiKey) {
  ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// Approved plan items knowledge base for patient Lakshmi Devi
const APPROVED_PLAN_ITEMS = [
  {
    id: 'item_01',
    title: 'Fasting Blood Sugar & HbA1c Lab Sample',
    due_date: '07 Oct 2026',
    due_time: '08:00 AM',
    status: 'overdue',
    original_text: 'Repeat fasting blood glucose and HbA1c on post-discharge day 3 at accredited pathology lab before 9:00 AM.',
    provider: 'Apollo Diagnostics Greams Road (1.2 km away)',
  },
  {
    id: 'item_02',
    title: 'Morning Blood Pressure & Pulse Recording',
    due_date: '08 Oct 2026 (Today)',
    due_time: '09:00 AM',
    status: 'pending',
    original_text: 'Monitor BP twice daily (seated, after 5 min rest). Target systolic < 130 mmHg. Record pulse rate.',
    provider: 'Home Care / Digital BP Cuff',
  },
  {
    id: 'item_03',
    title: 'Cardiology Wound & Groin Puncture Site Inspection',
    due_date: '08 Oct 2026 (Today)',
    due_time: '11:00 AM',
    status: 'pending',
    original_text: 'Inspect right femoral sheath entry point for any swelling, warmth, or hematoma formation. Keep clean and dry.',
    provider: 'Home Care Inspection',
  },
  {
    id: 'item_04',
    title: '12-Lead ECG & Echo Review Appointment',
    due_date: '15 Oct 2026',
    due_time: '10:30 AM',
    status: 'pending',
    original_text: 'Follow-up review with Dr. Anita Sharma at OPD Suite 4 on 15 Oct with repeat 12-lead ECG and echo assessment.',
    provider: 'Apollo Heart Centre OPD Room 4, Greams Road Block 2 (Dr. Anita Sharma)',
  },
  {
    id: 'item_05',
    title: 'Gentle 15-Minute Flat Surface Walk',
    due_date: '08 Oct 2026 (Today)',
    due_time: '07:00 AM',
    status: 'completed',
    original_text: 'Light flat walking for 15 minutes in shaded area. Avoid strenuous stair climbing or lifting weights > 5 kg.',
    provider: 'Daily Physical Care',
  },
];

const VERBATIM_WARNING_SIGNS = [
  'Sudden severe chest tightness, pressure, crushing sensation or pain radiating to left arm, neck, shoulder, or jaw',
  'Unexplained breathlessness at rest or waking up gasping for air in the middle of the night',
  'Repeated dizziness, loss of balance, sudden blackouts, or fainting episodes',
  'Bleeding that does not stop after 10 minutes of direct firm pressure (puncture site, gums, urine, or dark tarry stools)',
  'Rapid swelling of both feet, ankles, or lower legs accompanied by sudden weight gain greater than 2 kg in 48 hours',
  'Cold, clammy profuse sweat accompanied by nausea, severe vomiting, and overwhelming weakness',
];

// Question classification endpoint
const handleQuestionClassify: express.RequestHandler = async (req, res) => {
  try {
    const { question, language } = req.body;

    if (!question || typeof question !== 'string') {
      res.status(400).json({ error: 'Question is required' });
      return;
    }

    const qLower = question.toLowerCase();

    // 1. Emergency safety check
    const isEmergency =
      qLower.includes('chest') ||
      qLower.includes('heart attack') ||
      qLower.includes('breathless') ||
      qLower.includes('can\'t breathe') ||
      qLower.includes('gasping') ||
      qLower.includes('fainted') ||
      qLower.includes('blackout') ||
      qLower.includes('heavy bleeding') ||
      qLower.includes('severe pain') ||
      qLower.includes('unconscious') ||
      qLower.includes('emergency') ||
      qLower.includes('112');

    if (isEmergency) {
      res.json({
        route: 'emergency',
        emergency_phone: '112',
        warning_signs: VERBATIM_WARNING_SIGNS,
        message: 'EMERGENCY: If you are experiencing warning symptoms, dial 112 immediately or seek immediate emergency care.',
      });
      return;
    }

    // 2. Medication safety check - ALWAYS ESCALATE
    const isMedicine =
      qLower.includes('medicine') ||
      qLower.includes('tablet') ||
      qLower.includes('pill') ||
      qLower.includes('dose') ||
      qLower.includes('dosing') ||
      qLower.includes('ticagrelor') ||
      qLower.includes('aspirin') ||
      qLower.includes('ecosprin') ||
      qLower.includes('brilinta') ||
      qLower.includes('atorvastatin') ||
      qLower.includes('metoprolol') ||
      qLower.includes('betaloc') ||
      qLower.includes('metformin') ||
      qLower.includes('paracetamol') ||
      qLower.includes('side effect') ||
      qLower.includes('missed dose') ||
      qLower.includes('take with food') ||
      qLower.includes('can i take');

    if (isMedicine) {
      res.json({
        route: 'medicine',
        answer: 'Your medication question has been logged and escalated to Dr. Anita Sharma and your cardiology care team. A clinician will review and respond directly.',
        escalated: true,
        escalation_reason: 'Clinical Medication Safety Rule: Medication instructions must never be automated.',
      });
      return;
    }

    // 3. Symptom check - ALWAYS ESCALATE
    const isSymptom =
      qLower.includes('swollen') ||
      qLower.includes('swelling') ||
      qLower.includes('knee') ||
      qLower.includes('fever') ||
      qLower.includes('rash') ||
      qLower.includes('cough') ||
      qLower.includes('vomit') ||
      qLower.includes('nausea') ||
      qLower.includes('dizzy') ||
      qLower.includes('headache') ||
      qLower.includes('wound') ||
      qLower.includes('bruise') ||
      qLower.includes('symptom');

    if (isSymptom) {
      res.json({
        route: 'symptom',
        answer: 'Your symptom update has been logged and escalated to your care team for clinical review. If symptoms are severe or worsening, please consult the Warning Signs or call 112.',
        escalated: true,
        escalation_reason: 'Clinical Symptom Evaluation Rule: Symptoms require clinical evaluation.',
      });
      return;
    }

    // 4. Plan questions: Answer with approved plan items & citations
    if (ai) {
      try {
        const planContext = JSON.stringify(APPROVED_PLAN_ITEMS, null, 2);
        const prompt = `You are the CarePlus Follow-up Coordinator assistant for patient Lakshmi Devi.
Language requested: ${language || 'en'}.
The patient asked: "${question}".

Approved patient plan items:
${planContext}

STRICT SAFETY RULES:
1. You may ONLY answer questions regarding scheduled appointments, tests, and care items using the approved plan data above.
2. NEVER diagnose, prescribe, give medical advice, or speculate.
3. Cite the exact item IDs (e.g. ["item_01"], ["item_04"]) in the cited_item_ids array.
4. Keep the answer clear, comforting, and direct (1-2 sentences).

Return a JSON object matching this schema:
{
  "route": "plan",
  "answer": "string",
  "cited_item_ids": ["string"]
}`;

        const geminiRes = await ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                route: { type: Type.STRING },
                answer: { type: Type.STRING },
                cited_item_ids: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                },
              },
              required: ['route', 'answer', 'cited_item_ids'],
            },
          },
        });

        const text = geminiRes.text;
        if (text) {
          const parsed = JSON.parse(text);
          res.json({
            route: 'plan',
            answer: parsed.answer,
            cited_item_ids: parsed.cited_item_ids || [],
          });
          return;
        }
      } catch (err) {
        console.error('Gemini error:', err);
      }
    }

    // Deterministic plan matching if Gemini is unavailable or errors
    if (qLower.includes('blood') || qLower.includes('sugar') || qLower.includes('lab') || qLower.includes('test')) {
      res.json({
        route: 'plan',
        answer: 'Your Fasting Blood Sugar & HbA1c test sample was scheduled for 07 Oct at Apollo Diagnostics Greams Road (currently overdue).',
        cited_item_ids: ['item_01'],
      });
      return;
    }

    if (qLower.includes('appointment') || qLower.includes('doctor') || qLower.includes('ecg') || qLower.includes('sharma')) {
      res.json({
        route: 'plan',
        answer: 'Your follow-up review with Dr. Anita Sharma is scheduled for 15 Oct at 10:30 AM at Apollo Heart Centre OPD Suite 4.',
        cited_item_ids: ['item_04'],
      });
      return;
    }

    if (qLower.includes('walk') || qLower.includes('exercise')) {
      res.json({
        route: 'plan',
        answer: 'Your plan includes a gentle 15-minute flat surface walk daily in a shaded area. Avoid lifting > 5 kg.',
        cited_item_ids: ['item_05'],
      });
      return;
    }

    res.json({
      route: 'plan',
      answer: 'According to your care plan, your key tasks include monitoring blood pressure twice daily, checking the groin puncture site, and light walking.',
      cited_item_ids: ['item_02', 'item_03', 'item_05'],
    });
  } catch (error) {
    console.error('Error handling question:', error);
    res.status(500).json({ error: 'Internal server error processing question' });
  }
};

app.post('/api/question/classify', handleQuestionClassify);
app.post('/question/classify', handleQuestionClassify);

async function start() {
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`CarePlus Full-stack Server listening on port ${PORT}`);
  });
}

start();
