import React, { useRef, useEffect, useState } from 'react';

export type ChatMessage = {
  message: string;
  from: "left" | "right";
  timestamp: number;
};

interface ChatPanelProps {
  isMobile: boolean;
  messages: ChatMessage[];
  isMe: "left" | "right";
  chatOpen: boolean;
  setChatOpen: (open: boolean) => void;
  unreadChat: boolean;
  onSendMessage: (message: string) => void;
}

export default function ChatPanel({
  isMobile,
  messages,
  isMe,
  chatOpen,
  setChatOpen,
  unreadChat,
  onSendMessage,
}: ChatPanelProps) {
  const [chatInput, setChatInput] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (chatOpen) {
      chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, chatOpen]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    onSendMessage(chatInput.trim());
    setChatInput("");
  };

  return (
    <div className={`fixed z-50 flex flex-col items-end ${isMobile ? 'bottom-0 left-0 right-0 px-3 pb-3' : 'bottom-6 right-6'}`}>
      {chatOpen ? (
        <div className={`bg-surface-1 border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden mb-4 ${isMobile ? 'w-full h-[22rem]' : 'w-80 h-[28rem]'}`}>
          <div className="p-3 border-b border-border flex justify-between items-center bg-surface-2">
            <span className="font-mono text-xs font-bold tracking-widest uppercase text-foreground">Chat Session</span>
            <button onClick={() => setChatOpen(false)} className="opacity-50 hover:opacity-100 text-lg leading-none text-foreground">&times;</button>
          </div>
          <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2">
            {messages.length === 0 ? (
              <div className="text-center opacity-50 text-xs mt-4 text-foreground">No messages yet. Say hi!</div>
            ) : (
              messages.map((m, i) => (
                <div key={i} className={`flex flex-col ${m.from === isMe ? 'items-end' : 'items-start'}`}>
                  <div className={`px-3 py-1.5 text-sm max-w-[85%] break-words ${m.from === isMe ? 'bg-foreground text-background rounded-2xl rounded-br-sm' : 'bg-surface-0 text-foreground rounded-2xl rounded-bl-sm border border-border'}`}>
                    {m.message}
                  </div>
                </div>
              ))
            )}
            <div ref={chatEndRef} />
          </div>
          <form onSubmit={handleSend} className="p-2 border-t border-border flex gap-2">
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="Type a message..."
              className="flex-1 bg-surface-2 border border-border rounded-full px-3 py-1.5 text-sm focus:outline-none focus:border-foreground text-foreground"
            />
            <button type="submit" disabled={!chatInput.trim()} className="bg-foreground text-background rounded-full px-4 py-1.5 text-sm font-medium disabled:opacity-50 transition-opacity">
              Send
            </button>
          </form>
        </div>
      ) : (
        <button
          onClick={() => setChatOpen(true)}
          className="w-12 h-12 bg-surface-1 border border-border rounded-full shadow-lg flex items-center justify-center hover:bg-surface-2 transition-colors relative text-foreground"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
          </svg>
          {unreadChat && (
            <span className="absolute top-0 right-0 w-3 h-3 bg-red-500 rounded-full border-2 border-surface-1"></span>
          )}
        </button>
      )}
    </div>
  );
}
