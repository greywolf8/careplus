import { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Sparkles, FileText, Languages, MessageSquare, Trash2, Plus } from 'lucide-react';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface Capability {
  id: string;
  name: string;
  description: string;
  icon: any;
  color: string;
}

const capabilities: Capability[] = [
  {
    id: 'extract',
    name: 'Extract Care Plan',
    description: 'Extract follow-up items from discharge summaries',
    icon: FileText,
    color: 'bg-info-container text-info',
  },
  {
    id: 'translate',
    name: 'Translate',
    description: 'Translate text to patient\'s preferred language',
    icon: Languages,
    color: 'bg-success-container text-success',
  },
  {
    id: 'classify',
    name: 'Classify Questions',
    description: 'Classify patient questions by category',
    icon: MessageSquare,
    color: 'bg-warning-container text-warning',
  },
];

export function AIAgent() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: 'Hello! I\'m your AI assistant for CarePlus. I can help you with:\n\n• Extract care plans from discharge summaries\n• Translate text to patient languages\n• Classify patient questions\n\nHow can I help you today?',
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [selectedCapability, setSelectedCapability] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  async function handleSend() {
    if (!input.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsTyping(true);

    // Simulate AI response (replace with actual AI server call)
    setTimeout(() => {
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: generateResponse(input, selectedCapability),
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMessage]);
      setIsTyping(false);
      setSelectedCapability(null);
    }, 1000 + Math.random() * 1000);
  }

  function generateResponse(userInput: string, capability: string | null): string {
    if (capability === 'extract') {
      return 'I can help you extract care plan items from a discharge summary. Please paste the discharge summary text, and I\'ll identify follow-up items, medications, and care instructions.';
    }
    if (capability === 'translate') {
      return 'I can translate text to the patient\'s preferred language. Please provide the text you want translated and specify the target language (Hindi, Tamil, etc.).';
    }
    if (capability === 'classify') {
      return 'I can classify patient questions by category (medication, appointment, symptoms, etc.). Please provide the patient\'s question, and I\'ll categorize it for you.';
    }
    return `I understand you're asking about: "${userInput}". How can I assist you further? You can also use the capabilities on the right for specific tasks.`;
  }

  function handleCapabilityClick(capabilityId: string) {
    setSelectedCapability(capabilityId);
    const capability = capabilities.find((c) => c.id === capabilityId);
    if (capability) {
      setInput(capability.description);
    }
  }

  function clearChat() {
    setMessages([
      {
        id: '1',
        role: 'assistant',
        content: 'Hello! I\'m your AI assistant for CarePlus. I can help you with:\n\n• Extract care plans from discharge summaries\n• Translate text to patient languages\n• Classify patient questions\n\nHow can I help you today?',
        timestamp: new Date(),
      },
    ]);
  }

  function handleKeyPress(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div className="p-8 space-y-6 max-w-7xl mx-auto w-full h-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <Bot className="w-6 h-6 text-primary" />
            AI Agent
          </h1>
          <p className="text-sm text-slate-600 mt-0.5">
            Your intelligent assistant for CarePlus tasks
          </p>
        </div>
        <button
          onClick={clearChat}
          className="flex items-center gap-2 px-3 py-2 text-sm text-slate-600 hover:text-slate-900 hover:bg-surface-container rounded-lg transition-colors"
        >
          <Trash2 className="w-4 h-4" />
          Clear Chat
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 h-[calc(100vh-200px)]">
        {/* Chat Area */}
        <div className="lg:col-span-3 bg-white rounded-2xl border border-border shadow-sm flex flex-col overflow-hidden">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4 scrollbar-thin">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex gap-3 ${
                  message.role === 'user' ? 'justify-end' : 'justify-start'
                }`}
              >
                {message.role === 'assistant' && (
                  <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary shrink-0">
                    <Bot className="w-4 h-4" />
                  </div>
                )}
                <div
                  className={`max-w-2xl rounded-2xl px-4 py-3 ${
                    message.role === 'user'
                      ? 'bg-primary text-white'
                      : 'bg-surface-container text-slate-900'
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                  <p className="text-[10px] mt-1 opacity-70">
                    {message.timestamp.toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
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

          {/* Input Area */}
          <div className="p-4 border-t border-border">
            <div className="flex gap-3">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Type your message or use a capability..."
                className="flex-1 px-4 py-2.5 bg-surface-container-low border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm"
              />
              <button
                onClick={handleSend}
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
                    onClick={() => handleCapabilityClick(capability.id)}
                    className={`w-full p-3 rounded-xl border border-border hover:border-primary/30 hover:bg-surface-container transition-all text-left ${
                      selectedCapability === capability.id
                        ? 'border-primary bg-primary-container'
                        : ''
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`w-8 h-8 rounded-lg ${capability.color} flex items-center justify-center shrink-0`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-semibold text-slate-900">
                          {capability.name}
                        </h3>
                        <p className="text-xs text-slate-600 mt-0.5">
                          {capability.description}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="bg-surface-container-low rounded-xl p-4">
            <h3 className="text-sm font-semibold text-slate-900 mb-2">Quick Actions</h3>
            <div className="space-y-2">
              <button className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-600 hover:text-slate-900 hover:bg-white rounded-lg transition-colors">
                <Plus className="w-4 h-4" />
                New Discharge
              </button>
              <button className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-600 hover:text-slate-900 hover:bg-white rounded-lg transition-colors">
                <FileText className="w-4 h-4" />
                Review Summary
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
