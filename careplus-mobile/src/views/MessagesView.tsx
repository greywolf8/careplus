import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { t } from '../i18n/translations';
import { MessageSquare, Send, Clock, User } from 'lucide-react';
import { dataService } from '../services/dataService';

export const MessagesView: React.FC = () => {
  const { patientContext, language, theme } = useAuth();
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const isLight = theme === 'light';

  useEffect(() => {
    const loadMessages = async () => {
      if (!patientContext.patientId) return;
      setLoading(true);
      try {
        const msgs = await dataService.getQuestions(patientContext.patientId);
        setMessages(msgs);
      } catch (error) {
        console.error('Failed to load messages:', error);
      } finally {
        setLoading(false);
      }
    };
    loadMessages();
  }, [patientContext.patientId]);

  const handleSendMessage = async () => {
    if (!newMessage.trim() || sending || !patientContext.patientId) return;
    setSending(true);
    try {
      const sent = await dataService.addQuestionMessage({
        patient_id: patientContext.patientId,
        sender: patientContext.role === 'caregiver' ? 'caregiver' : 'patient',
        sender_name: patientContext.patientName,
        text: newMessage,
        type: 'question',
      });
      if (sent) {
        setMessages([...messages, sent]);
        setNewMessage('');
      }
    } catch (error) {
      console.error('Failed to send message:', error);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="min-h-screen p-4 space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <MessageSquare className="w-5 h-5" style={isLight ? { color: '#007A73' } : { color: '#2dd4bf' }} />
        <h1 className="text-lg font-bold" style={isLight ? { color: '#18324A' } : { color: '#ffffff' }}>
          {t(language, 'messages')}
        </h1>
      </div>

      {loading ? (
        <div className="text-center py-8">
          <p className="text-sm" style={isLight ? { color: '#587084' } : { color: '#94a3b8' }}>
            Loading messages...
          </p>
        </div>
      ) : (
        <>
          <div className="space-y-3 max-h-[60vh] overflow-y-auto">
            {messages.length === 0 ? (
              <div className="text-center py-12 border border-dashed rounded-lg" style={isLight ? { borderColor: '#C5DCE8' } : { borderColor: 'rgba(71,85,105,0.5)' }}>
                <MessageSquare className="w-12 h-12 mx-auto mb-3" style={isLight ? { color: '#D4EEF7' } : { color: 'rgba(71,85,105,0.5)' }} />
                <p className="text-sm" style={isLight ? { color: '#587084' } : { color: '#94a3b8' }}>
                  No messages yet
                </p>
              </div>
            ) : (
              messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`p-3 rounded-2xl ${
                    msg.sender === 'care_team'
                      ? 'ml-8'
                      : 'mr-8'
                  }`}
                  style={
                    msg.sender === 'care_team'
                      ? isLight
                        ? { backgroundColor: '#E8F3FC', border: '1px solid #B8D4EA' }
                        : { backgroundColor: 'rgba(30,58,138,0.7)', border: '1px solid rgba(37,99,235,0.5)' }
                      : isLight
                      ? { backgroundColor: '#EAF4FA', border: '1px solid #C5DCE8' }
                      : { backgroundColor: 'rgba(30,41,59,1)', border: '1px solid rgba(71,85,105,1)' }
                  }
                >
                  <div className="flex items-center gap-2 mb-1">
                    <User className="w-3 h-3" style={isLight ? { color: '#587084' } : { color: '#94a3b8' }} />
                    <span className="text-xs font-semibold" style={isLight ? { color: '#18324A' } : { color: '#f1f5f9' }}>
                      {msg.sender_name}
                    </span>
                    <span className="text-[10px]" style={isLight ? { color: '#7A9AAD' } : { color: '#64748b' }}>
                      {new Date(msg.created_at).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-sm" style={isLight ? { color: '#18324A' } : { color: '#f1f5f9' }}>
                    {msg.body}
                  </p>
                  {msg.message_type && (
                    <span className="inline-block mt-1 px-2 py-0.5 rounded-full text-[10px]" style={isLight ? { backgroundColor: '#D4EEF7', color: '#587084' } : { backgroundColor: 'rgba(71,85,105,0.5)', color: '#94a3b8' }}>
                      {msg.message_type}
                    </span>
                  )}
                </div>
              ))
            )}
          </div>

          <div className="border-t pt-4" style={isLight ? { borderColor: '#C5DCE8' } : { borderColor: 'rgba(71,85,105,0.5)' }}>
            <div className="flex gap-2">
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder={t(language, 'ask_placeholder')}
                className="flex-1 px-4 py-3 rounded-xl text-sm focus:outline-none"
                style={isLight
                  ? { backgroundColor: '#ffffff', border: '1px solid #C5DCE8', color: '#18324A' }
                  : { backgroundColor: '#020817', border: '1px solid rgba(71,85,105,1)', color: '#f1f5f9' }}
                onKeyPress={(e) => e.key === 'Enter' && newMessage.trim() && !sending && handleSendMessage()}
              />
              <button
                onClick={handleSendMessage}
                disabled={!newMessage.trim() || sending}
                className="px-4 py-3 rounded-xl text-white text-sm font-medium flex items-center gap-2 transition active:scale-95 disabled:opacity-50"
                style={{ backgroundColor: '#00AFA3' }}
              >
                {sending ? <Clock className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                <span>{t(language, 'send')}</span>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
