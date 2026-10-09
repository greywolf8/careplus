import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { dataService } from '../services/dataService';
import { logPatientQuestion } from '../services/supabase/questionService';
import { aiService, ClassifyResponse } from '../services/aiService';
import { speechService } from '../services/speechService';
import { CitationChip } from '../components/common/CitationChip';
import { TaskDetailSheet } from '../components/tasks/TaskDetailSheet';
import { CreateCoordinationModal } from '../components/common/CreateCoordinationModal';
import { t } from '../i18n/translations';
import { PatientQuestionMessage, CoordinationCardType } from '../types';
import {
  Send,
  Mic,
  MicOff,
  Shield,
  AlertTriangle,
  Clock,
  Phone,
  Stethoscope,
  WifiOff,
  ShieldAlert,
  ArrowRight,
  PlusCircle,
  FileText,
} from 'lucide-react';

export const AskView: React.FC = () => {
  const {
    patientContext,
    language,
    selectedTaskId,
    setSelectedTaskId,
    setActiveSubRoute,
    isOnline,
    refreshData,
  } = useAuth();

  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isListeningMic, setIsListeningMic] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [messages, setMessages] = useState<PatientQuestionMessage[]>([]);

  // Coordination Modal trigger state
  const [coordModalState, setCoordModalState] = useState<{
    open: boolean;
    type: CoordinationCardType;
    description: string;
  }>({
    open: false,
    type: 'general-review',
    description: '',
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let isMounted = true;
    dataService.getQuestions(patientContext.patientId).then((msgs) => {
      if (isMounted) setMessages(msgs);
    });
    return () => {
      isMounted = false;
    };
  }, [patientContext.patientId]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isSending]);

  const handleSend = async (questionText?: string) => {
    const textToSend = (questionText || inputText).trim();
    if (!textToSend || isSending) return;

    if (!isOnline) {
      setErrorMessage('AI Assistant requires an internet connection.');
      return;
    }

    setErrorMessage(null);
    setInputText('');

    // 1. Add user question message to thread
    const userMsg = await dataService.addQuestionMessage({
      patient_id: patientContext.patientId,
      sender: 'patient',
      sender_name:
        patientContext.role === 'caregiver'
          ? 'Ramesh Kumar (Caregiver)'
          : patientContext.patientName,
      text: textToSend,
      type: 'question',
    });

    setMessages((prev) => [...prev, userMsg]);
    setIsSending(true);

    try {
      // 2. Call AI Service (unified abstraction)
      const result: ClassifyResponse = await aiService.classifyAndAnswer(
        textToSend,
        language,
        patientContext
      );

      if (result.route === 'emergency') {
        const replyText = result.message || 'EMERGENCY: If you are experiencing warning symptoms, dial 112 immediately or seek immediate emergency care.';
        const botMsg = await dataService.addQuestionMessage({
          patient_id: patientContext.patientId,
          sender: 'system',
          sender_name: 'CarePlus Emergency Alert',
          text: replyText,
          type: 'emergency_warning',
        });
        setMessages((prev) => [...prev, botMsg]);
        logPatientQuestion(patientContext.patientId, textToSend, 'escalate', replyText);
      } else if (result.route === 'medicine' || result.route === 'symptom' || result.route === 'other') {
        const replyText = result.answer || (result.route === 'medicine'
          ? 'Medication-related questions need review by your care team. Medication instructions must never be automated.'
          : 'Your message requires clinical review by your care team.');
        const botMsg = await dataService.addQuestionMessage({
          patient_id: patientContext.patientId,
          sender: 'system',
          sender_name: 'CarePlus Coordinator',
          text: replyText,
          type: 'escalation',
          escalation_reason:
            result.escalation_reason ||
            (result.route === 'medicine'
              ? 'Medication instructions must never be automated.'
              : 'Clinical symptoms require doctor evaluation.'),
        });
        setMessages((prev) => [...prev, botMsg]);
        logPatientQuestion(
          patientContext.patientId,
          textToSend,
          result.route === 'medicine' ? 'to_doctor' : 'escalate',
          replyText
        );
      } else {
        // Plan answer with citations
        const replyText = result.answer || 'According to your discharge plan, here are your scheduled items.';
        const botMsg = await dataService.addQuestionMessage({
          patient_id: patientContext.patientId,
          sender: 'system',
          sender_name: 'CarePlus Coordinator',
          text: replyText,
          type: 'plan_answer',
          cited_item_ids: result.cited_item_ids || [],
        });
        setMessages((prev) => [...prev, botMsg]);
        logPatientQuestion(patientContext.patientId, textToSend, 'to_self', replyText, result.cited_item_ids || []);
      }
    } catch {
      const fallbackMsg = await dataService.addQuestionMessage({
        patient_id: patientContext.patientId,
        sender: 'system',
        sender_name: 'CarePlus Coordinator',
        text:
          'Unable to reach the clinical coordinator. For urgent concerns, please consult Warning Signs or call 112.',
        type: 'escalation',
      });
      setMessages((prev) => [...prev, fallbackMsg]);
    } finally {
      setIsSending(false);
      refreshData();
    }
  };

  const handleMicToggle = () => {
    if (isListeningMic) {
      setIsListeningMic(false);
      speechService.stop();
    } else {
      const recognition = speechService.createSpeechRecognition(
        language,
        (transcript) => {
          setInputText(transcript);
          setIsListeningMic(false);
        },
        () => setIsListeningMic(false)
      );

      if (recognition) {
        setIsListeningMic(true);
        recognition.start();
      } else {
        alert('Voice input is not supported in this browser.');
      }
    }
  };

  const sampleQuestions = [
    'What do I need to do today?',
    'When is my next appointment?',
    'When is my blood test?',
    'What does this discharge instruction mean?',
    'What tests are scheduled?',
  ];

  const handleOpenCoordModalFromMsg = (msgText: string) => {
    const isMed =
      msgText.toLowerCase().includes('med') ||
      msgText.toLowerCase().includes('tablet') ||
      msgText.toLowerCase().includes('dose');
    setCoordModalState({
      open: true,
      type: isMed ? 'medication-delay' : 'symptom-report',
      description: `Follow-up on inquiry: "${msgText}"`,
    });
  };

  return (
    <div className="flex flex-col h-[calc(100dvh-130px)] pb-1">
      {/* Subtle Clinical Safety Guarantee Banner */}
      <div className="shrink-0 p-3 mb-2 rounded-2xl bg-slate-900 border border-teal-900/60 text-[11px] text-slate-300 flex items-start gap-2.5">
        <Stethoscope className="w-4 h-4 text-teal-400 shrink-0 mt-0.5" />
        <p className="leading-relaxed">
          AI can explain and organize your discharge plan. It does not diagnose conditions, prescribe treatment, or change medications.
        </p>
      </div>

      {/* Offline Alert if disconnected */}
      {!isOnline && (
        <div className="shrink-0 mb-2 p-2.5 rounded-xl bg-amber-950/80 border border-amber-700 text-xs text-amber-200 flex items-center gap-2">
          <WifiOff className="w-4 h-4 text-amber-400 shrink-0" />
          <span>AI Assistant requires an internet connection.</span>
        </div>
      )}

      {/* Error message banner */}
      {errorMessage && (
        <div className="shrink-0 mb-2 p-2.5 rounded-xl bg-rose-950/80 border border-rose-800 text-xs text-rose-200 flex items-center justify-between">
          <span>{errorMessage}</span>
          <button onClick={() => setErrorMessage(null)} className="text-xs text-rose-300 font-bold ml-2">
            Dismiss
          </button>
        </div>
      )}

      {/* Chat Messages Stream */}
      <div className="flex-1 overflow-y-auto space-y-3.5 pr-1 no-scrollbar">
        {messages.map((msg) => {
          const isPatient = msg.sender === 'patient';
          const isDoctor = msg.sender === 'care_team';
          const isEmergency = msg.type === 'emergency_warning';
          const isEscalation = msg.type === 'escalation';

          // 1. EMERGENCY MESSAGE
          if (isEmergency) {
            return (
              <div
                key={msg.id}
                className="w-full rounded-2xl bg-amber-950/95 border-2 border-amber-500 p-4 shadow-xl text-amber-100 animate-in fade-in"
              >
                <div className="flex items-center gap-2 text-amber-400 font-bold text-xs uppercase tracking-wider mb-2">
                  <AlertTriangle className="w-4 h-4" />
                  <span>URGENT — CLINICAL EMERGENCY PROTOCOL</span>
                </div>
                <p className="text-xs font-semibold leading-relaxed mb-3">
                  {msg.text}
                </p>
                <p className="text-[11px] text-amber-200/90 mb-3">
                  Review your discharge warning signs immediately or call emergency medical response.
                </p>

                <div className="grid grid-cols-2 gap-2">
                  <a
                    href="tel:112"
                    className="min-h-[44px] rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 shadow transition active:scale-95"
                  >
                    <Phone className="w-4 h-4" />
                    <span>Call 112</span>
                  </a>

                  <button
                    onClick={() => setActiveSubRoute('warning_signs')}
                    className="min-h-[44px] rounded-xl bg-amber-900 hover:bg-amber-800 text-amber-200 border border-amber-600 font-bold text-xs flex items-center justify-center gap-1.5 transition active:scale-95"
                  >
                    <ShieldAlert className="w-4 h-4" />
                    <span>Warning Signs</span>
                  </button>
                </div>
              </div>
            );
          }

          // 2. ESCALATION (HUMAN REVIEW REQUIRED)
          if (isEscalation) {
            return (
              <div key={msg.id} className="flex flex-col items-start max-w-[92%]">
                <div className="flex items-center gap-1.5 text-[11px] font-bold text-amber-400 mb-1 px-1">
                  <Clock className="w-3.5 h-3.5" />
                  <span>Human Review Required</span>
                </div>
                <div className="rounded-2xl rounded-tl-sm bg-slate-900 border border-amber-900/60 p-4 text-xs text-slate-200 leading-relaxed shadow-sm space-y-3">
                  <p>{msg.text}</p>
                  {msg.escalation_reason && (
                    <div className="text-[11px] text-amber-300/90 italic bg-amber-950/40 border border-amber-900/50 p-2 rounded-xl">
                      {msg.escalation_reason}
                    </div>
                  )}

                  <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
                    <span className="text-[11px] text-slate-400">Escalate this question to team?</span>
                    <button
                      onClick={() => handleOpenCoordModalFromMsg(msg.text)}
                      className="px-3 py-1.5 rounded-xl bg-teal-700 hover:bg-teal-600 text-white text-xs font-bold flex items-center gap-1.5 transition active:scale-95 shadow-sm"
                    >
                      <PlusCircle className="w-3.5 h-3.5" />
                      <span>Request Care Team Review</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          }

          // 3. DOCTOR MESSAGE
          if (isDoctor) {
            return (
              <div key={msg.id} className="flex flex-col items-start max-w-[88%]">
                <div className="flex items-center gap-1.5 text-[11px] font-semibold text-teal-400 mb-1 px-1">
                  <Stethoscope className="w-3.5 h-3.5" />
                  <span>{t(language, 'from_care_team')} · {msg.sender_name}</span>
                </div>
                <div className="rounded-2xl rounded-tl-sm bg-slate-900 border border-teal-800/60 p-3.5 text-xs text-slate-100 leading-relaxed shadow-sm">
                  <p>{msg.text}</p>
                </div>
              </div>
            );
          }

          // 4. PATIENT MESSAGE
          if (isPatient) {
            return (
              <div key={msg.id} className="flex flex-col items-end">
                <span className="text-[10px] text-slate-400 mb-1 px-1">{msg.sender_name}</span>
                <div className="max-w-[85%] rounded-2xl rounded-tr-sm bg-teal-600 text-white p-3.5 text-xs leading-relaxed shadow-sm font-medium">
                  {msg.text}
                </div>
              </div>
            );
          }

          // 5. PLAN ANSWER WITH VERIFIED CITATIONS
          return (
            <div key={msg.id} className="flex flex-col items-start max-w-[90%]">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-teal-300 mb-1 px-1">
                <Shield className="w-3.5 h-3.5" />
                <span>{msg.sender_name}</span>
              </div>
              <div className="rounded-2xl rounded-tl-sm bg-slate-900 border border-teal-900/40 p-3.5 text-xs text-slate-200 leading-relaxed shadow-sm">
                <p className="mb-2.5">{msg.text}</p>
                {msg.cited_item_ids && msg.cited_item_ids.length > 0 && (
                  <div className="pt-2 border-t border-slate-800/80">
                    <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold mb-1.5 flex items-center gap-1">
                      <FileText className="w-3 h-3 text-teal-400" />
                      <span>Source: Approved Care Plan</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {msg.cited_item_ids.map((id) => (
                        <CitationChip
                          key={id}
                          itemId={id}
                          onClick={(clickedId) => setSelectedTaskId(clickedId)}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* Loading state indicator */}
        {isSending && (
          <div className="flex items-center gap-2 p-3 rounded-2xl bg-slate-900/90 border border-teal-900/60 text-xs text-teal-300 animate-in fade-in">
            <span className="w-2.5 h-2.5 rounded-full bg-teal-400 animate-ping" />
            <span>Analyzing your care-plan information...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggested Questions Carousel */}
      <div className="shrink-0 py-2 overflow-x-auto no-scrollbar flex items-center gap-1.5">
        {sampleQuestions.map((sq, i) => (
          <button
            key={i}
            disabled={isSending || !isOnline}
            onClick={() => handleSend(sq)}
            className="min-h-[36px] px-3 py-1 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 border border-slate-800 rounded-xl text-[11px] text-teal-300 whitespace-nowrap transition active:scale-95"
          >
            {sq}
          </button>
        ))}
      </div>

      {/* Message Input Bar */}
      <div className="shrink-0 pt-2 border-t border-slate-800">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex items-center gap-2"
        >
          <button
            type="button"
            onClick={handleMicToggle}
            aria-label="Use voice input"
            className={`min-h-[44px] min-w-[44px] rounded-2xl flex items-center justify-center transition ${
              isListeningMic
                ? 'bg-red-600 text-white animate-pulse'
                : 'bg-slate-900 border border-slate-700 text-teal-400 hover:bg-slate-800'
            }`}
          >
            {isListeningMic ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </button>

          <input
            type="text"
            value={inputText}
            disabled={isSending || !isOnline}
            onChange={(e) => setInputText(e.target.value)}
            placeholder={
              isOnline ? t(language, 'ask_placeholder') : 'Connect to internet to ask questions'
            }
            className="flex-1 min-h-[44px] px-4 rounded-2xl bg-slate-900 border border-slate-700 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-teal-500 disabled:opacity-50"
          />

          <button
            type="submit"
            disabled={!inputText.trim() || isSending || !isOnline}
            aria-label={t(language, 'send')}
            className="min-h-[44px] min-w-[44px] rounded-2xl bg-teal-600 hover:bg-teal-500 disabled:opacity-40 disabled:hover:bg-teal-600 text-white flex items-center justify-center transition active:scale-95 shadow-sm"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>

      {/* Task Detail Bottom Sheet when tapping citation chip */}
      <TaskDetailSheet
        itemId={selectedTaskId}
        onClose={() => setSelectedTaskId(null)}
      />

      {/* Pre-populated Coordination Card Modal */}
      {coordModalState.open && (
        <CreateCoordinationModal
          patientContext={patientContext}
          initialType={coordModalState.type}
          initialDescription={coordModalState.description}
          onClose={() =>
            setCoordModalState({ open: false, type: 'general-review', description: '' })
          }
          onCreated={() => refreshData()}
        />
      )}
    </div>
  );
};
