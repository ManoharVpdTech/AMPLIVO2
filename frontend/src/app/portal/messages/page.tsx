'use client';
import { useEffect, useRef, useState } from 'react';
import { Send, Paperclip, Loader2, MessageSquare, X, FileText } from 'lucide-react';
import { messagingService, ConversationRead, MessageRead } from '@/services/portalServices';
import { fileManagerService } from '@/services/moduleServices';
import { useAuthStore } from '@/store/authStore';
import { useToastStore } from '@/store/toastStore';

// BUG-011: Relative date formatting helper
function formatMessageTimestamp(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const msgDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  if (msgDay.getTime() === today.getTime()) {
    return timeStr; // Today: just time
  } else if (msgDay.getTime() === yesterday.getTime()) {
    return `Yesterday, ${timeStr}`;
  } else {
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ', ' + timeStr;
  }
}

function getDateLabel(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const msgDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  if (msgDay.getTime() === today.getTime()) return 'Today';
  if (msgDay.getTime() === yesterday.getTime()) return 'Yesterday';
  return date.toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' });
}

function groupMessagesByDate(messages: MessageRead[]): { label: string; messages: MessageRead[] }[] {
  const groups: { label: string; messages: MessageRead[] }[] = [];
  let currentLabel = '';

  for (const msg of messages) {
    const label = getDateLabel(msg.created_at);
    if (label !== currentLabel) {
      currentLabel = label;
      groups.push({ label, messages: [msg] });
    } else {
      groups.at(-1)?.messages.push(msg);
    }
  }
  return groups;
}

export default function MessagesPage() {
  const [conversation, setConversation] = useState<ConversationRead | null>(null);
  const [messages, setMessages] = useState<MessageRead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [msgText, setMsgText] = useState('');
  const [sending, setSending] = useState(false);
  const [attaching, setAttaching] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [filePreviewUrl, setFilePreviewUrl] = useState<string | null>(null);
  // BUG-02: message to send along with attachment
  const [attachmentMessage, setAttachmentMessage] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const { user } = useAuthStore();
  const showToast = useToastStore((s) => s.showToast);

  const load = async () => {
    setLoading(true);
    setError(false);
    try {
      const conv = await messagingService.getOrCreateConversation();
      setConversation(conv);
      const msgs = await messagingService.getMessages(conv.id);
      setMessages(msgs);
      await messagingService.markRead(conv.id);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!msgText.trim() || !conversation) return;
    setSending(true);
    try {
      const sent = await messagingService.sendMessage(conversation.id, msgText.trim());
      setMessages((prev) => [...prev, sent]);
      setMsgText('');
    } catch {
      showToast('Failed to send message.', 'error');
    } finally {
      setSending(false);
    }
  };

  // BUG-01: File select only stages the file — does NOT auto-send
  const handleFileSelect = (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const file = fileList[0];
    setPendingFile(file);
    setAttachmentMessage(''); // reset message field when new file selected
    if (file.type.startsWith('image/')) {
      setFilePreviewUrl(URL.createObjectURL(file));
    } else {
      setFilePreviewUrl(null);
    }
  };

  const handleCancelAttachment = () => {
    if (filePreviewUrl) {
      URL.revokeObjectURL(filePreviewUrl);
    }
    setPendingFile(null);
    setFilePreviewUrl(null);
    setAttachmentMessage('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // BUG-02: Also send the optional message text alongside the attachment
  const handleConfirmSendAttachment = async () => {
    if (!pendingFile || !conversation) return;
    setAttaching(true);
    try {
      const uploaded = await fileManagerService.uploadBinary(pendingFile);
      const apiOrigin = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1').replace(/\/api\/v1\/?$/, '');
      const url = uploaded.url.startsWith('http') ? uploaded.url : `${apiOrigin}${uploaded.url}`;

      // Build message: optional user text + file link
      const fileLine = `📎 ${uploaded.original_name} - ${url}`;
      const fullMessage = attachmentMessage.trim()
        ? `${attachmentMessage.trim()}\n${fileLine}`
        : fileLine;

      const sent = await messagingService.sendMessage(conversation.id, fullMessage);
      setMessages((prev) => [...prev, sent]);
      showToast('File attached and sent.', 'success');
      handleCancelAttachment();
    } catch {
      showToast('Failed to attach file.', 'error');
    } finally {
      setAttaching(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (loading) {
    return (
      <div className="h-[calc(100vh-4rem)] p-6">
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm h-full flex items-center justify-center">
          <Loader2 size={32} className="animate-spin text-[#4C1D95]" />
        </div>
      </div>
    );
  }

  if (error || !conversation) {
    return (
      <div className="h-[calc(100vh-4rem)] p-6">
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm h-full flex flex-col items-center justify-center gap-3 text-slate-400">
          <MessageSquare size={32} />
          <p className="text-sm">Couldn&apos;t load your conversation.</p>
          <button onClick={load} className="text-sm text-[#4C1D95] font-medium hover:underline">Retry</button>
        </div>
      </div>
    );
  }

  const messageGroups = groupMessagesByDate(messages);

  return (
    <div className="h-[calc(100vh-4rem)] p-6">
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm h-full flex flex-col overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200">
          <h2 className="text-base font-bold text-slate-900">{conversation.subject}</h2>
          <p className="text-xs text-slate-500">Direct line to your Amplivo account team</p>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-400">
              <MessageSquare size={48} className="mb-4" />
              <p className="text-sm">No messages yet — say hello!</p>
            </div>
          ) : (
            // BUG-011: Render messages grouped by date with date dividers
            messageGroups.map((group) => (
              <div key={group.label}>
                {/* Date divider */}
                <div className="flex items-center gap-3 my-4">
                  <div className="flex-1 h-px bg-slate-200" />
                  <span className="text-xs font-medium text-slate-400 px-2 py-0.5 bg-slate-100 rounded-full whitespace-nowrap">
                    {group.label}
                  </span>
                  <div className="flex-1 h-px bg-slate-200" />
                </div>

                <div className="space-y-4">
                  {group.messages.map((m) => {
                    const isMine = m.sender_id === user?.id;
                    return (
                      <div key={m.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                        <div className="max-w-[70%]">
                          <div className={`flex items-baseline gap-2 mb-1 ${isMine ? 'flex-row-reverse' : ''}`}>
                            <span className="text-xs font-semibold text-slate-700">{isMine ? 'You' : 'Amplivo Team'}</span>
                            <span className="text-[10px] text-slate-400">{formatMessageTimestamp(m.created_at)}</span>
                          </div>
                          <div className={`p-4 rounded-2xl text-sm leading-relaxed ${isMine ? 'bg-[#4C1D95] text-white rounded-tr-sm' : 'bg-slate-100 text-slate-800 rounded-tl-sm'}`}>
                            {m.content}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
          <div ref={bottomRef} />
        </div>

        <div className="p-4 border-t border-slate-200">
          <div className="flex items-end gap-2 bg-slate-50 border border-slate-200 rounded-2xl p-2 focus-within:ring-2 focus-within:ring-[#4C1D95]/20 focus-within:border-[#4C1D95] transition-all">
            <input ref={fileInputRef} type="file" className="hidden" onChange={(e) => handleFileSelect(e.target.files)} />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={attaching}
              className="p-2 text-slate-400 hover:text-[#4C1D95] rounded-full hover:bg-white transition-colors disabled:opacity-50"
            >
              {attaching ? <Loader2 size={18} className="animate-spin" /> : <Paperclip size={18} />}
            </button>
            <textarea
              value={msgText}
              onChange={(e) => setMsgText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Type your message..."
              className="flex-1 bg-transparent border-none focus:outline-none resize-none max-h-32 min-h-[44px] py-3 text-sm text-slate-700"
              rows={1}
            />
            <button
              onClick={handleSend}
              disabled={!msgText.trim() || sending}
              className={`p-3 rounded-xl flex items-center justify-center transition-colors shrink-0 mb-0.5 ${
                msgText.trim() && !sending ? 'bg-[#4C1D95] text-white hover:bg-[#3b1574]' : 'bg-slate-200 text-slate-400'
              }`}
            >
              {sending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
            </button>
          </div>
        </div>
      </div>

      {/* BUG-01 + BUG-02: Confirmation Modal with optional "send with message" field */}
      {pendingFile && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full overflow-hidden border border-slate-100 animate-in fade-in zoom-in duration-150">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                <Paperclip size={18} className="text-[#4C1D95]" />
                Confirm Attachment
              </h3>
              <button
                type="button"
                onClick={handleCancelAttachment}
                disabled={attaching}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-xs text-slate-500">
                Are you sure you want to send this file attachment to your account team?
              </p>

              <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 flex items-center gap-4">
                {filePreviewUrl ? (
                  <img
                    src={filePreviewUrl}
                    alt="Attachment preview"
                    className="w-16 h-16 object-cover rounded-lg border border-slate-200 shrink-0"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-xl bg-purple-50 text-[#4C1D95] flex items-center justify-center shrink-0">
                    <FileText size={24} />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800 truncate">
                    {pendingFile.name}
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {formatFileSize(pendingFile.size)} • {pendingFile.type || 'File'}
                  </p>
                </div>
              </div>

              {/* BUG-02: Optional message to send alongside attachment */}
              <div>
                <label htmlFor="attach-msg" className="block text-xs font-medium text-slate-500 mb-1.5">
                  Add a message <span className="text-slate-400 font-normal">(optional)</span>
                </label>
                <textarea
                  id="attach-msg"
                  value={attachmentMessage}
                  onChange={(e) => setAttachmentMessage(e.target.value)}
                  placeholder="Write a message to send with this attachment..."
                  rows={3}
                  disabled={attaching}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#4C1D95]/20 focus:border-[#4C1D95] resize-none disabled:opacity-50"
                />
              </div>
            </div>

            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={handleCancelAttachment}
                disabled={attaching}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-200/60 rounded-xl transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmSendAttachment}
                disabled={attaching}
                className="px-4 py-2 text-sm font-medium text-white bg-[#4C1D95] hover:bg-[#3b1574] rounded-xl transition-colors flex items-center gap-2 shadow-sm disabled:opacity-50"
              >
                {attaching ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send size={16} />
                    Send Attachment
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
