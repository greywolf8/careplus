import { useState, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Send, Bot, User, Sparkles, FileText, Languages, MessageSquare, Trash2, Stethoscope, ChevronDown } from 'lucide-react';
import { getDoctorPatients } from '../services/doctorService';
import { webAgentChat } from '../lib/api';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  sources?: string[];
  actions?: Array<{ tool: string; args?: any; ok: boolean; result: string }>;
}

interface Capability {
  id: string;
  name: string;
  description: string;
  icon: any;
  color: string;
  prompt: string;
}

const capabilities: Capability[] = [
  {
    id: 'summarize',
    name: 'Summarize discharge',
    description: "Summarize this patient's discharge summary and care plan",
    icon: FileText,
    color: 'bg-info-container text-info',
    prompt: 'Summarize this patient: discharge reason, care plan items, medications, and any overdue items.',
  },
  {
    id: 'translate',
    name: 'Translate note',
    description: 'Translate a plain-language note to the patient language',
    icon: Languages,
    color: 'bg-success-container text-success',
    prompt: 'Draft a short, plain-language patient note in the patient’s preferred language summarizing the key follow-up instructions.',
  },
  {
    id: 'classify',
    name: 'Draft patient reply',
    description: 'Answer a patient question using approved care-plan items',
    icon: MessageSquare,
    color: 'bg-warning-container text-warning',
    prompt: 'A patient asked a question. Based on the approved care-plan items below, draft a safe, plain answer and cite the items used.',
  },
];

export function AIAgent() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content:
        "Hello! I'm your CarePlus assistant. Select a patient above to answer questions grounded in their discharge summary, care plan, medications, and warning signs. I won't diagnose or change medications — I help you find, summarize, and draft.",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: patients } = useQuery({
    queryKey: ['doctor-patients'],
    queryFn: getDoctorPatients,
  });

  const selected = patients?.find((p) => p.id === selectedPatient) || null;

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  async function handleSend(text?: string) {
    const message = (text ?? input).trim();
    if (!message) return;

    const userMessage: Message = {
      id: `${Date.now()}`,
      role: 'user',
      content: message,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsTyping(true);

    // Build short conversational history for the backend
    const history = messages
      .filter((m) => m.id !== '1')
      .slice(-8)
      .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));

    try {
      const res = await webAgentChat({
        patient_id: selectedPatient || null,
        message,
        history,
      });
      if (res.error) {
        setMessages((prev) => [
          ...prev,
          { id: `${Date.now()}-e`, role: 'assistant', content: `Sorry, I couldn't get a response: ${res.error}`, timestamp: new Date() },
        ]);
      } else {
        // If the backend auto-detected the patient from the message, reflect it
        // in the selector so subsequent messages keep that chart context.
        if (res.data.auto_resolved && res.data.patient_id && res.data.patient_id !== selectedPatient) {
          setSelectedPatient(res.data.patient_id);
        }
        setMessages((prev) => [
          ...prev,
          {
            id: `${Date.now()}-a`,
            role: 'assistant',
            content: res.data.answer,
            timestamp: new Date(),
            sources: res.data.sources,
            actions: res.data.actions,
          },
        ]);
      }
    } catch (e: any) {
      setMessages((prev) => [
        ...prev,
        { id: `${Date.now()}-x`, role: 'assistant', content: `Request failed: ${e?.message || 'unknown error'}`, timestamp: new Date() },
      ]);
    } finally {
      setIsTyping(false);
    }
  }

  function handleKeyPress(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div className="p-8 space-y-6 max-w-7xl mx-auto w-full h-full">
      {/* Header + patient context (same row) */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <Bot className="w-6 h-6 text-primary" />
            AI Agent
          </h1>
          <p className="text-sm text-slate-600 mt-0.5">
            Physician assistant grounded in your patients&apos; data
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {/* Contained patient selector */}
          <div className="inline-flex items-center gap-2 h-10 rounded-lg border border-border bg-white pl-3 pr-2 shadow-sm focus-within:ring-2 focus-within:ring-primary/30">
            <Stethoscope className="w-4 h-4 text-primary shrink-0" />
            <span className="text-sm text-slate-500 hidden md:inline whitespace-nowrap">Patient</span>
            <div className="relative">
              <select
                value={selectedPatient}
                onChange={(e) => setSelectedPatient(e.target.value)}
                className="appearance-none w-44 sm:w-56 max-w-[13rem] sm:max-w-none h-8 bg-transparent text-sm text-slate-800 rounded-md pr-7 truncate focus:outline-none"
              >
                <option value="">None (general assistant)</option>
                {patients?.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.full_name}{p.mrn ? ` (${p.mrn})` : ''}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 text-slate-400 pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2" />
            </div>
          </div>

          {selected ? (
            <span className="text-xs px-2.5 py-1 rounded-full bg-info-container text-info font-semibold whitespace-nowrap">
              Using {selected.full_name}&apos;s chart
            </span>
          ) : (
            <span className="text-xs text-slate-500 hidden md:inline whitespace-nowrap">
              {patients && patients.length === 0 ? 'No patients yet — add one to get started' : 'No patient selected'}
            </span>
          )}

          <button
            onClick={() =>
              setMessages([
                {
                  id: '1',
                  role: 'assistant',
                  content:
                    "Chat cleared. Select a patient and ask anything about their discharge, care plan, or medications.",
                  timestamp: new Date(),
                },
              ])
            }
            className="flex items-center gap-2 px-3 py-2 text-sm text-slate-600 hover:text-slate-900 hover:bg-surface-container rounded-lg transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            Clear Chat
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 h-[calc(100vh-260px)]">
        {/* Chat Area */}
        <div className="lg:col-span-3 bg-white rounded-2xl border border-border shadow-sm flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {message.role === 'assistant' && (
                  <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary shrink-0">
                    <Bot className="w-4 h-4" />
                  </div>
                )}
                <div
                  className={`max-w-2xl rounded-2xl px-4 py-3 ${
                    message.role === 'user' ? 'bg-primary text-white' : 'bg-surface-container text-slate-900'
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                  {message.actions && message.actions.length > 0 && (
                    <ul className="mt-2 space-y-0.5">
                      {message.actions.map((a, i) => (
                        <li key={i} className={`text-[11px] flex items-start gap-1.5 ${a.ok ? 'text-success' : 'text-danger'}`}>
                          <span aria-hidden>{a.ok ? '✓' : '✕'}</span>
                          <span>{a.result}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  {message.sources && message.sources.length > 0 && (
                    <p className="text-[10px] mt-2 text-slate-500">
                      Context used: {message.sources.join(', ')}
                    </p>
                  )}
                  <p className="text-[10px] mt-1 opacity-70">
                    {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                {message.role === 'user' && (
                  <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 shrink-0">
                    <User className="w-4 h-4" />
                  </div>
                )}
              </div>
            ))}
            {isTyping && (
              <div className="flex gap-3 justify-start">
                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary shrink-0">
                  <Bot className="w-4 h-4" />
                </div>
                <div className="bg-surface-container rounded-2xl px-4 py-3">
                  <div className="flex gap-1">
                    <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" />
                    <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce delay-100" />
                    <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce delay-200" />
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="p-4 border-t border-border">
            <div className="flex gap-3">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder={selected ? `Ask about ${selected.full_name}...` : 'Ask CarePlus (select a patient for chart context)...'}
                className="flex-1 px-4 py-2.5 bg-surface-container-low border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm"
              />
              <button
                onClick={() => handleSend()}
                disabled={!input.trim() || isTyping}
                className="px-4 py-2.5 bg-primary hover:bg-primary-700 text-white rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <Send className="w-4 h-4" />
                Send
              </button>
            </div>
          </div>
        </div>

        {/* Capabilities Panel */}
        <div className="space-y-4">
          <div>
            <h2 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              Capabilities
            </h2>
            <div className="space-y-2">
              {capabilities.map((capability) => {
                const Icon = capability.icon;
                return (
                  <button
                    key={capability.id}
                    onClick={() => {
                      if (!selectedPatient) return;
                      handleSend(capability.prompt);
                    }}
                    disabled={!selectedPatient}
                    title={!selectedPatient ? 'Select a patient first' : capability.description}
                    className={`w-full p-3 rounded-xl border border-border text-left transition-all ${
                      selectedPatient ? 'hover:border-primary/30 hover:bg-surface-container' : 'opacity-50 cursor-not-allowed'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`w-8 h-8 rounded-lg ${capability.color} flex items-center justify-center shrink-0`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-semibold text-slate-900">{capability.name}</h3>
                        <p className="text-xs text-slate-600 mt-0.5">{capability.description}</p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
            {!selectedPatient && (
              <p className="text-xs text-slate-500 mt-2">Pick a patient above to enable these.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
