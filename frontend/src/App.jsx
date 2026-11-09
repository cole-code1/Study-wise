import { useEffect, useRef, useState } from 'react';
import { Activity, ArrowDown, ArrowUpRight, BookOpen, CalendarDays, ChevronDown, Clock3, Command, Ellipsis, GraduationCap, MessageCircle, Plus, Search, Send, ShieldCheck, Sparkles, Trash2, X } from 'lucide-react';
import { useAuth } from './context/AuthContext.jsx';

const greetings = [
  'Hi! What are you working on today?',
  'Hello! Ready to learn something new?'
];

function relativeDate(value) {
  if (!value) return 'Just now';
  const normalizedDate = value.includes('T') ? value : value.replace(' ', 'T');
  const date = new Date(/[zZ]|[+-]\d{2}:?\d{2}$/.test(normalizedDate) ? normalizedDate : `${normalizedDate}Z`);
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const day = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const difference = Math.round((start - day) / 86400000);
  if (difference === 0) return 'Today';
  if (difference === 1) return 'Yesterday';
  if (difference < 7) return `${difference} days ago`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function App() {
  const { api, connection } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [activeChat, setActiveChat] = useState(null);
  const [query, setQuery] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [showAll, setShowAll] = useState(false);
  const messagesEnd = useRef(null);

  async function refreshConversations() {
    const items = await api('/conversations');
    setConversations(items);
    return items;
  }

  useEffect(() => {
    refreshConversations()
      .then((items) => {
        if (items.length) return api(`/conversations/${items[0].id}`).then(setActiveChat);
      })
      .catch((cause) => setError(cause.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    messagesEnd.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [activeChat?.messages?.length]);

  async function openConversation(id) {
    setError('');
    try {
      setActiveChat(await api(`/conversations/${id}`));
    } catch (cause) {
      setError(cause.message);
    }
  }

  async function newConversation() {
    setError('');
    try {
      const chat = await api('/conversations', { method: 'POST', body: JSON.stringify({}) });
      setConversations((items) => [chat, ...items]);
      setActiveChat(chat);
    } catch (cause) {
      setError(cause.message);
    }
  }

  async function deleteConversation(event, id) {
    event.stopPropagation();
    try {
      await api(`/conversations/${id}`, { method: 'DELETE' });
      const remaining = await refreshConversations();
      if (activeChat?.id === id) {
        setActiveChat(remaining.length ? await api(`/conversations/${remaining[0].id}`) : null);
      }
    } catch (cause) {
      setError(cause.message);
    }
  }

  async function sendMessage(event) {
    event.preventDefault();
    const content = message.trim();
    if (!content || sending) return;
    setError('');
    setSending(true);
    setMessage('');
    let chat = activeChat;
    try {
      if (!chat) {
        chat = await api('/conversations', { method: 'POST', body: JSON.stringify({}) });
        setActiveChat(chat);
      }
      const result = await api(`/conversations/${chat.id}/messages`, {
        method: 'POST',
        body: JSON.stringify({ content })
      });
      setActiveChat(result.conversation);
      await refreshConversations();
    } catch (cause) {
      setError(cause.message);
      setMessage(content);
    } finally {
      setSending(false);
    }
  }

  const filtered = conversations.filter((chat) => `${chat.title} ${chat.preview || ''}`.toLowerCase().includes(query.toLowerCase()));
  const visible = showAll || query ? filtered : filtered.slice(0, 4);

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="Studywise home">
          <span className="brand-mark"><GraduationCap size={19} strokeWidth={2.2} /></span>
          <span>StudyWise<span className="brand-period">.</span></span>
        </a>
        <div className="topbar-right">
          <span className="privacy-note"><ShieldCheck size={14} /> Private & secure</span>
        </div>
      </header>

      <main id="top" className="page-wrap">
        {error && <div className="error-banner" role="alert"><span>{error}</span><button onClick={() => setError('')} aria-label="Dismiss"><X size={16} /></button></div>}

        <div className="workspace-layout">
        <aside className="history-section" aria-labelledby="history-heading">
          <div className="section-heading">
            <div className="heading-title-wrap">
              <div className="heading-icon"><MessageCircle size={17} /></div>
              <div><h2 id="history-heading">Your conversations</h2><p>Pick up where you left off.</p></div>
            </div>
            <button className="primary-button" onClick={newConversation}><Plus size={17} /> New chat</button>
          </div>

          <div className="history-tools">
            <label className="search-box"><Search size={16} /><input aria-label="Search conversations" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search conversations" /><kbd><Command size={10} /> K</kbd></label>
            <button className="filter-button" onClick={() => setShowAll((state) => !state)}>{showAll ? 'Recent' : 'All chats'} <ChevronDown size={15} className={showAll ? 'rotate' : ''} /></button>
          </div>

          {loading ? <div className="loading-state"><span className="loader" /> Loading your conversations...</div> : visible.length ? (
            <div className="conversation-grid">
              {visible.map((chat, index) => (
                <button key={chat.id} className={`conversation-card ${activeChat?.id === chat.id ? 'is-active' : ''}`} onClick={() => openConversation(chat.id)} style={{ '--card-index': index }}>
                  <div className="card-topline"><span className={`topic-icon topic-${index % 4}`}><Activity size={17} /></span><span className="card-date"><Clock3 size={13} />{relativeDate(chat.updatedAt)}</span><span className="card-actions" onClick={(event) => event.stopPropagation()}><button className="icon-button delete-button" onClick={(event) => deleteConversation(event, chat.id)} aria-label={`Delete ${chat.title}`} title="Delete conversation"><Trash2 size={14} /></button></span></div>
                  <h3>{chat.title || 'Untitled conversation'}</h3>
                  <p className="card-preview">{chat.preview || 'Start a conversation with your study assistant.'}</p>
                  <div className="card-bottom"><span><MessageCircle size={13} /> {chat.messageCount} messages</span><span className="open-link">Open <ArrowUpRight size={14} /></span></div>
                </button>
              ))}
            </div>
          ) : (
            <div className="empty-history"><div className="empty-icon"><MessageCircle size={22} /></div><h3>{query ? 'No matching conversations' : 'A fresh start'}</h3><p>{query ? 'Try a different search term.' : 'Your chats will appear here when you start a conversation.'}</p>{!query && <button className="text-button" onClick={newConversation}>Start a conversation <ArrowUpRight size={14} /></button>}</div>
          )}
        </aside>

        <section className="chat-section" aria-label="Chat with your student AI assistant">
          
          <div className="chat-panel">
            <div className="chat-top"><span className="assistant-avatar"><GraduationCap size={17} /></span><div><strong>Studywise AI</strong><span>Your curious, always-ready study partner</span></div><button className="icon-button chat-menu" title="Chat options"><Ellipsis size={19} /></button></div>
            <div className="chat-messages" aria-live="polite">
              {activeChat?.messages?.length ? activeChat.messages.map((item) => (
                <div key={item.id} className={`message-row ${item.role === 'user' ? 'from-user' : ''}`}><span className="message-avatar">{item.role === 'user' ? 'You' : <GraduationCap size={14} />}</span><div className="message-content"><span className="message-name">{item.role === 'user' ? 'You' : 'Studywise AI'}</span><div className={`message-bubble ${item.role}`}>{item.content}</div><time>{relativeDate(item.createdAt)}</time></div></div>
              )) : (
                <div className="welcome-message"><div className="welcome-message-icon"><Sparkles size={18} /></div><div><strong>{greetings[0]}</strong><p>Break down a tricky concept, brainstorm an essay, or build a study plan. We can work through it step by step.</p></div></div>
              )}
              {sending && <div className="typing-row"><span className="message-avatar"><GraduationCap size={14} /></span><span className="typing-dots"><i /><i /><i /></span><span>Studywise is thinking</span></div>}
              <div ref={messagesEnd} />
            </div>
            <form className="composer" onSubmit={sendMessage}><input aria-label="Message your study assistant" value={message} onChange={(event) => setMessage(event.target.value)} placeholder="What would you like to learn?" maxLength={4000} /><span className="composer-hint">Press <kbd>Enter</kbd> to send</span><button type="submit" className="send-button" aria-label="Send message" disabled={!message.trim() || sending}>{sending ? <span className="button-loader" /> : <Send size={17} />}</button></form>
            <p className="disclaimer"><ShieldCheck size={12} /> Use AI as a study partner; verify important facts with your course materials.</p>
          </div>
        </section>
        </div>

        <footer className="page-footer"><span>Studywise <span className="brand-period">.</span></span><span><BookOpen size={13} /> Learn at your own pace</span><button onClick={() => setError('For support, contact your school or course administrator.')}>Need help? <ArrowDown size={13} /></button></footer>
      </main>
    </div>
  );
}

export default App;
