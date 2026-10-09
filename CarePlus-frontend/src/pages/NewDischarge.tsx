import { useState, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Upload, FileText, CheckCircle, Loader2, AlertCircle, Sparkles } from 'lucide-react';
import { getDoctorPatients } from '../services/doctorService';
import { webExtractDischarge, webPublishDischarge } from '../lib/api';
import { extractTextFromFile, isSupportedUpload } from '../lib/extractFile';

interface ExtractedItem {
  id?: string;
  item_type: string;
  content: string;
  quote?: string;
  due_date?: string | null;
  priority?: string;
  source_span?: { quote?: string; start?: number; end?: number } | null;
  state?: string;
  metadata?: { quality_flags?: string[] } | null;
}

interface ExtractResult {
  items: ExtractedItem[];
  could_not_place?: any[];
  quality?: any;
  completeness?: any;
}

const TYPE_LABELS: Record<string, string> = {
  appointment: 'Appointment',
  test: 'Test',
  referral: 'Referral',
  medication: 'Medication',
  care_instruction: 'Care',
  warning_sign: 'Warning sign',
  diet: 'Diet',
  rehab: 'Rehab',
  wound_care: 'Wound care',
};

export function NewDischarge() {
  const [step, setStep] = useState(1);
  const [selectedPatient, setSelectedPatient] = useState('');
  const [dischargeDate, setDischargeDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [language, setLanguage] = useState('en');
  const [rawText, setRawText] = useState('');

  const [extracting, setExtracting] = useState(false);
  const [extractError, setExtractError] = useState<string | null>(null);
  const [extractResult, setExtractResult] = useState<ExtractResult | null>(null);
  const [selectedIdx, setSelectedIdx] = useState<number[]>([]);

  // Per-item (by original index) medication details the doctor can edit before publishing
  type MedDetail = { name: string; dose: string; frequency: string; duration: string };
  const [medEdits, setMedEdits] = useState<Record<number, MedDetail>>({});

  const setMedField = (idx: number, field: keyof MedDetail, value: string) =>
    setMedEdits((prev) => ({
      ...prev,
      [idx]: { ...(prev[idx] || { name: '', dose: '', frequency: '', duration: '' }), [field]: value },
    }));

  // File upload (PDF / DOCX / TXT) -> extract text into the summary textarea
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [extractingFile, setExtractingFile] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [fileNote, setFileNote] = useState<string | null>(null);

  async function handleFile(file: File) {
    setFileError(null);
    setFileNote(null);
    if (file.size > 10 * 1024 * 1024) {
      setFileError('File exceeds the 10 MB limit.');
      return;
    }
    if (!isSupportedUpload(file.name, file.type)) {
      setFileError('Unsupported file. Please upload a PDF, DOCX, or TXT file.');
      return;
    }
    setExtractingFile(true);
    try {
      const text = await extractTextFromFile(file);
      setRawText(text);
      setFileNote(`Loaded ${text.length.toLocaleString()} characters from "${file.name}". Review below, then Continue.`);
    } catch (e: any) {
      setFileError(e?.message || 'Failed to read the file');
    } finally {
      setExtractingFile(false);
    }
  }

  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [publishResult, setPublishResult] = useState<{
    items_published: number;
    medications_synced: number;
    warning_signs_synced: number;
  } | null>(null);

  const { data: patients, isLoading: patientsLoading } = useQuery({
    queryKey: ['doctor-patients'],
    queryFn: getDoctorPatients,
  });

  const canContinueStep1 = Boolean(selectedPatient) && rawText.trim().length > 20;

  async function runExtraction() {
    setExtracting(true);
    setExtractError(null);
    try {
      const res = await webExtractDischarge(selectedPatient, rawText.trim(), dischargeDate, language);
      if (res.error) {
        setExtractError(res.error);
        return;
      }
      const result = res.data as ExtractResult;
      setExtractResult(result);
      // Default: all items selected
      setSelectedIdx((result.items || []).map((_, i) => i));
      // Prefill editable medication fields from extracted metadata
      const pref: Record<number, { name: string; dose: string; frequency: string; duration: string }> = {};
      (result.items || []).forEach((it, i) => {
        if (it.item_type === 'medication') {
          const d = (it.metadata && it.metadata.medication_details) || {};
          pref[i] = {
            name: d.name || '',
            dose: d.dose || '',
            frequency: d.frequency || '',
            duration: d.duration || '',
          };
        }
      });
      setMedEdits(pref);
      setStep(2);
    } catch (e: any) {
      setExtractError(e?.message || 'Extraction request failed');
    } finally {
      setExtracting(false);
    }
  }

  async function publish() {
    setPublishing(true);
    setPublishError(null);
    try {
      const items: any[] = [];
      (extractResult?.items || []).forEach((it, i) => {
        if (!selectedIdx.includes(i)) return;
        const md = it.metadata || {};
        const extracted = (md.medication_details as any) || {};
        let medication_details: any = undefined;
        if (it.item_type === 'medication') {
          const e = medEdits[i] || { name: '', dose: '', frequency: '', duration: '' };
          medication_details = {
            name: (e.name || extracted.name || '').trim() || null,
            dose: (e.dose || extracted.dose || '').trim() || null,
            frequency: (e.frequency || extracted.frequency || '').trim() || null,
            duration: (e.duration || extracted.duration || '').trim() || null,
          };
        }
        items.push({
          item_type: it.item_type,
          content: it.content,
          quote: it.quote,
          due_date: it.due_date || null,
          title: it.content.length > 60 ? it.content.slice(0, 57) + '...' : it.content,
          priority: it.priority,
          source_span: it.source_span || null,
          metadata: md,
          medication_details,
        });
      });
      const res = await webPublishDischarge({
        patient_id: selectedPatient,
        discharge_date: dischargeDate,
        raw_text: rawText.trim(),
        language,
        items,
      });
      if (res.error) {
        setPublishError(res.error);
        return;
      }
      setPublishResult({
        items_published: res.data.items_published,
        medications_synced: res.data.medications_synced,
        warning_signs_synced: res.data.warning_signs_synced,
      });
    } catch (e: any) {
      setPublishError(e?.message || 'Publish failed');
    } finally {
      setPublishing(false);
    }
  }

  const q = extractResult?.quality;
  const c = extractResult?.completeness;

  return (
    <div className="p-8 space-y-6 max-w-7xl mx-auto w-full">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">New Discharge</h1>
        <p className="text-sm text-slate-600 mt-0.5">Process a new patient discharge</p>
      </div>

      {/* Progress Steps */}
      <div className="flex items-center gap-4">
        {[1, 2, 3].map((s) => (
          <div key={s} className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
              step >= s ? 'bg-primary text-white' : 'bg-surface-container text-slate-600'
            }`}>
              {step > s ? <CheckCircle className="w-4 h-4" /> : s}
            </div>
            <span className={`text-sm ${step >= s ? 'text-slate-900 font-medium' : 'text-slate-500'}`}>
              {s === 1 ? 'Upload' : s === 2 ? 'What we found' : 'Review & publish'}
            </span>
            {s < 3 && <div className="w-16 h-0.5 bg-border" />}
          </div>
        ))}
      </div>

      {/* Step Content */}
      <div className="bg-white rounded-2xl border border-border shadow-sm p-6">
        {step === 1 && (
          <div className="space-y-6">
            <h2 className="text-lg font-semibold text-slate-900">Upload Discharge Summary</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Patient</label>
                <select
                  className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:bg-slate-50"
                  value={selectedPatient}
                  onChange={(e) => setSelectedPatient(e.target.value)}
                  disabled={patientsLoading}
                >
                  <option value="">
                    {patientsLoading ? 'Loading patients...' : 'Select a patient...'}
                  </option>
                  {patients?.map((patient) => (
                    <option key={patient.id} value={patient.id}>
                      {patient.full_name}{patient.mrn ? ` (${patient.mrn})` : ''}
                    </option>
                  ))}
                </select>
                {!patientsLoading && patients?.length === 0 && (
                  <p className="text-xs text-slate-500 mt-1.5">
                    No patients yet. Add one from the Patients tab first.
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Discharge Date</label>
                <input
                  type="date"
                  value={dischargeDate}
                  onChange={(e) => setDischargeDate(e.target.value)}
                  className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Language</label>
                <select
                  className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30"
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                >
                  <option value="en">English</option>
                  <option value="hi">Hindi</option>
                  <option value="ta">Tamil</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Discharge Summary Text</label>
                <textarea
                  rows={10}
                  value={rawText}
                  onChange={(e) => setRawText(e.target.value)}
                  className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm"
                  placeholder="Paste the discharge summary text here..."
                />
                <p className="text-xs text-slate-500 mt-1">
                  Do not include the patient's real name, phone, or ABHA ID — the pipeline de-identifies
                  text before AI processing.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Or upload file</label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.docx,.txt,application/pdf,text/plain"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleFile(f);
                    e.target.value = '';
                  }}
                />
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => !extractingFile && fileInputRef.current?.click()}
                  onKeyDown={(e) => {
                    if ((e.key === 'Enter' || e.key === ' ') && !extractingFile) fileInputRef.current?.click();
                  }}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const f = e.dataTransfer.files?.[0];
                    if (f) handleFile(f);
                  }}
                  className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  {extractingFile ? (
                    <div className="flex flex-col items-center">
                      <Loader2 className="w-12 h-12 text-primary animate-spin mx-auto mb-2" />
                      <p className="text-sm text-slate-600">Extracting text from file…</p>
                    </div>
                  ) : (
                    <>
                      <Upload className="w-12 h-12 text-slate-400 mx-auto mb-2" />
                      <p className="text-sm text-slate-600">Click to upload or drag and drop</p>
                      <p className="text-xs text-slate-500 mt-1">PDF, DOCX, TXT up to 10MB</p>
                    </>
                  )}
                </div>
                {fileNote && (
                  <p className="text-xs text-success mt-1.5">{fileNote}</p>
                )}
                {fileError && (
                  <p className="text-xs text-danger mt-1.5">{fileError}</p>
                )}
              </div>

              {extractError && (
                <div className="flex items-start gap-2 px-4 py-3 bg-danger-container/20 border border-danger/30 rounded-lg text-sm text-danger">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>{extractError}</span>
                </div>
              )}
            </div>

            <div className="flex justify-end">
              <button
                onClick={runExtraction}
                disabled={!canContinueStep1 || extracting}
                className="px-6 py-2 bg-primary hover:bg-primary-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {extracting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Analyzing...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" /> Continue
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {step === 2 && extractResult && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">What We Found</h2>
                <p className="text-sm text-slate-600">
                  AI extracted {extractResult.items?.length ?? 0} item(s) from the discharge summary.
                </p>
              </div>
              {q && (
                <div className="text-right text-xs text-slate-500">
                  <div>Agreement: {Math.round((q.agreement_rate ?? 0) * 100)}%</div>
                  <div>Models: {(q.models_used || []).join(', ')}</div>
                  <div className={q.quality_pass ? 'text-success' : 'text-warning'}>
                    Quality {q.quality_pass ? 'passed' : 'needs review'}
                  </div>
                </div>
              )}
            </div>

            {c && (
              <div className={`px-4 py-3 rounded-lg border text-sm ${
                c.checklist_pass
                  ? 'bg-success-container/10 border-success/30 text-success'
                  : 'bg-warning-container/10 border-warning/20 text-warning'
              }`}>
                Completeness: {c.found_count ?? 0}/{c.required_count ?? 0} required items
                ({c.discharge_type}).{' '}
                {c.missing && c.missing.length > 0 && `Missing: ${c.missing.join(', ')}`}
              </div>
            )}

            {extractResult.items && extractResult.items.length > 0 ? (
              <div className="space-y-2">
                {extractResult.items.map((item, idx) => {
                  const checked = selectedIdx.includes(idx);
                  const priority = (item.priority || 'low').toLowerCase();
                  const prioColor =
                    priority === 'high'
                      ? 'bg-danger-container text-danger'
                      : priority === 'medium'
                      ? 'bg-warning-container text-warning'
                      : 'bg-surface-container text-slate-600';
                  return (
                    <div
                      key={idx}
                      className={`p-4 rounded-lg border transition-colors ${
                        checked ? 'border-primary/40 bg-primary/5' : 'border-border'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) =>
                            setSelectedIdx((prev) =>
                              e.target.checked
                                ? [...prev, idx]
                                : prev.filter((i) => i !== idx)
                            )
                          }
                          className="mt-1 accent-[var(--primary,#059669)]"
                        />
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                            <span className="px-2 py-0.5 rounded-full bg-info-container text-info text-xs font-semibold">
                              {TYPE_LABELS[item.item_type] || item.item_type}
                            </span>
                            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${prioColor}`}>
                              {item.priority || 'low'}
                            </span>
                            {item.due_date && (
                              <span className="text-xs text-slate-500">Due: {item.due_date}</span>
                            )}
                            {item.metadata?.quality_flags?.includes('unverified_quote') ||
                            item.metadata?.quality_flags?.includes('missing_quote') ? (
                              <span
                                className="px-2 py-0.5 rounded-full bg-warning-container text-warning text-xs font-semibold"
                                title="The source quote could not be matched verbatim in the summary. Verify before publishing."
                              >
                                Needs review
                              </span>
                            ) : null}
                          </div>
                          <p className="text-sm text-slate-900">{item.content}</p>
                          {item.quote && (
                            <p className="text-xs text-slate-500 mt-1.5 italic">"{item.quote}"</p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-12 text-slate-500 border border-dashed border-border rounded-lg">
                <FileText className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                <p>No items could be extracted automatically.</p>
                <p className="text-xs mt-1">
                  {extractResult.could_not_place && extractResult.could_not_place.length > 0
                    ? `${extractResult.could_not_place.length} section(s) could not be placed.`
                    : 'Try adding more detail to the summary text.'}
                </p>
              </div>
            )}

            {extractResult.could_not_place && extractResult.could_not_place.length > 0 && (
              <details className="text-sm">
                <summary className="cursor-pointer text-slate-600 font-medium">
                  {extractResult.could_not_place.length} item(s) could not be placed
                </summary>
                <ul className="mt-2 space-y-2 text-xs text-slate-500 list-disc pl-5">
                  {extractResult.could_not_place.map((c: any, i: number) => (
                    <li key={i} className="pb-1">
                      <div className="font-medium text-slate-700">
                        Reason: {c.reason || 'unknown'}
                      </div>
                      {c.item && (
                        <div className="mt-1 pl-2">
                          <div>Type: {c.item.item_type || c.item.category || 'unknown'}</div>
                          <div>Content: {c.item.content || c.item.text || 'N/A'}</div>
                          {c.item.quote && (
                            <div className="italic">Quote: "{c.item.quote}"</div>
                          )}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </details>
            )}

            <div className="flex justify-between">
              <button
                onClick={() => setStep(1)}
                className="px-6 py-2 bg-surface-container hover:bg-surface-container-high text-slate-700 font-medium rounded-lg transition-colors"
              >
                Back
              </button>
              <button
                onClick={() => setStep(3)}
                disabled={selectedIdx.length === 0}
                className="px-6 py-2 bg-primary hover:bg-primary-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50"
              >
                Review & Publish ({selectedIdx.length})
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-6">
            <h2 className="text-lg font-semibold text-slate-900">Review & Publish</h2>

            {publishResult ? (
              <div className="space-y-4">
                <div className="flex items-center gap-3 px-4 py-4 bg-success-container/15 border border-success/30 rounded-lg text-success">
                  <CheckCircle className="w-6 h-6" />
                  <div>
                    <p className="font-semibold">Published to care plan</p>
                    <p className="text-sm">
                      {publishResult.items_published} item(s) published ·{' '}
                      {publishResult.medications_synced} medication(s) and{' '}
                      {publishResult.warning_signs_synced} warning sign(s) synced to the patient app.
                    </p>
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => {
                      setStep(1);
                      setExtractResult(null);
                      setPublishResult(null);
                      setSelectedIdx([]);
                      setRawText('');
                      setSelectedPatient('');
                    }}
                    className="px-6 py-2 bg-surface-container hover:bg-surface-container-high text-slate-700 font-medium rounded-lg transition-colors"
                  >
                    Process another
                  </button>
                </div>
              </div>
            ) : (
              <>
                <p className="text-sm text-slate-600">
                  Publishing will add {selectedIdx.length} approved item(s) to the patient's care plan
                  and sync them to the patient mobile app.
                </p>

                <div className="space-y-2">
                  {(extractResult?.items || []).map((item, i) =>
                    !selectedIdx.includes(i) ? null : (
                      <div key={i} className="p-3 rounded-lg border border-border">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-sm text-slate-900">{item.content}</span>
                          <span className="px-2 py-0.5 rounded-full bg-info-container text-info text-xs font-semibold shrink-0">
                            {TYPE_LABELS[item.item_type] || item.item_type}
                          </span>
                        </div>

                        {item.item_type === 'medication' && (
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3">
                            <div>
                              <label className="block text-[11px] font-semibold text-slate-500 mb-1">Name</label>
                              <input
                                type="text"
                                value={medEdits[i]?.name || ''}
                                onChange={(e) => setMedField(i, 'name', e.target.value)}
                                placeholder="Drug name"
                                className="w-full px-2 py-1.5 border border-border rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-primary/30"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] font-semibold text-slate-500 mb-1">Dose</label>
                              <input
                                type="text"
                                value={medEdits[i]?.dose || ''}
                                onChange={(e) => setMedField(i, 'dose', e.target.value)}
                                placeholder="e.g. 5 mg"
                                className="w-full px-2 py-1.5 border border-border rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-primary/30"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] font-semibold text-slate-500 mb-1">Frequency</label>
                              <input
                                type="text"
                                value={medEdits[i]?.frequency || ''}
                                onChange={(e) => setMedField(i, 'frequency', e.target.value)}
                                placeholder="e.g. once daily"
                                className="w-full px-2 py-1.5 border border-border rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-primary/30"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] font-semibold text-slate-500 mb-1">Duration</label>
                              <input
                                type="text"
                                value={medEdits[i]?.duration || ''}
                                onChange={(e) => setMedField(i, 'duration', e.target.value)}
                                placeholder="e.g. 3 months"
                                className="w-full px-2 py-1.5 border border-border rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-primary/30"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  )}
                </div>

                {publishError && (
                  <div className="flex items-start gap-2 px-4 py-3 bg-danger-container/20 border border-danger/30 rounded-lg text-sm text-danger">
                    <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                    <span>{publishError}</span>
                  </div>
                )}

                <div className="flex justify-between">
                  <button
                    onClick={() => setStep(2)}
                    className="px-6 py-2 bg-surface-container hover:bg-surface-container-high text-slate-700 font-medium rounded-lg transition-colors"
                  >
                    Back
                  </button>
                  <button
                    onClick={publish}
                    disabled={publishing || selectedIdx.length === 0}
                    className="px-6 py-2 bg-primary hover:bg-primary-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {publishing ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" /> Publishing...
                      </>
                    ) : (
                      'Publish Care Plan'
                    )}
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
