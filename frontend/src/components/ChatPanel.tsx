import { useEffect, useRef, useState } from "react";
import { Send, Plane, AlertTriangle } from "lucide-react";
import ReactMarkdown from "react-markdown";
import type { Message, Sentiment, Customer } from "../types";

interface Props {
  messages: Message[];
  isLoading: boolean;
  isEscalated: boolean;
  sentiment: Sentiment | null;
  customer: Customer | null;
  onSend: (msg: string) => void;
}

const SENTIMENT_CONFIG = {
  calm:       { color: "text-green-400",  bg: "bg-green-500",  label: "Calm" },
  frustrated: { color: "text-amber-400",  bg: "bg-amber-500",  label: "Frustrated" },
  angry:      { color: "text-red-400",    bg: "bg-red-500",    label: "Angry" },
  very_angry: { color: "text-red-300",    bg: "bg-red-700",    label: "Very Angry" },
};

const TIER_COLORS: Record<string, string> = {
  Platinum: "text-cyan-300 bg-cyan-900/40 border-cyan-700/50",
  Gold:     "text-yellow-300 bg-yellow-900/40 border-yellow-700/50",
  Silver:   "text-gray-300 bg-gray-800/60 border-gray-600/50",
};

const QUICK_MESSAGES = [
  "My flight got cancelled, what are my options?",
  "I want a full refund please",
  "What compensation am I entitled to?",
  "I need to rebook my flight",
];

export default function ChatPanel({ messages, isLoading, isEscalated, sentiment, customer, onSend }: Props) {
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed || isLoading || isEscalated) return;
    onSend(trimmed);
    setInput("");
    inputRef.current?.focus();
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const sentConfig = sentiment
    ? SENTIMENT_CONFIG[sentiment.sentiment] ?? SENTIMENT_CONFIG.calm
    : null;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800 bg-gray-900/50">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-brand-500/20 border border-brand-500/40 flex items-center justify-center">
            <Plane size={16} className="text-brand-500" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">SkyConnect Support</p>
            <p className="text-xs text-gray-500">AI Resolution Agent</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Customer info badge */}
          {customer && (
            <span className={`badge border ${TIER_COLORS[customer.tier] ?? TIER_COLORS.Silver}`}>
              {customer.tier} · {customer.pnr}
            </span>
          )}
          {/* Sentiment badge */}
          {sentConfig && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gray-800 border border-gray-700">
              <span
                className={`w-2 h-2 rounded-full ${sentConfig.bg} ${
                  sentiment && sentiment.intensity >= 7 ? "sentiment-pulse" : ""
                }`}
              />
              <span className={`text-xs font-medium ${sentConfig.color}`}>
                {sentConfig.label}
              </span>
              {sentiment && (
                <span className="text-xs text-gray-500">{sentiment.intensity}/10</span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-6 text-center">
            <div className="w-16 h-16 rounded-2xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center">
              <Plane size={28} className="text-brand-500" />
            </div>
            <div>
              <p className="text-gray-300 font-medium mb-1">How can I help you today?</p>
              <p className="text-gray-500 text-sm">
                {customer
                  ? `I can see your booking for flight ${customer.flight} (${customer.route})`
                  : "Select a scenario to get started"}
              </p>
            </div>
            {/* Quick start buttons */}
            {customer && (
              <div className="flex flex-wrap gap-2 justify-center max-w-xs">
                {QUICK_MESSAGES.map((msg) => (
                  <button
                    key={msg}
                    onClick={() => onSend(msg)}
                    className="text-xs px-3 py-1.5 rounded-full bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 transition-colors"
                  >
                    {msg}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[80%] ${msg.role === "user" ? "chat-bubble-user" : "chat-bubble-agent"}`}>
              {msg.role === "assistant" ? (
                <ReactMarkdown className="prose prose-invert prose-sm max-w-none">
                  {msg.content}
                </ReactMarkdown>
              ) : (
                <p>{msg.content}</p>
              )}
              <p className="text-xs text-gray-500 mt-1.5">
                {new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </p>
            </div>
          </div>
        ))}

        {/* Typing indicator */}
        {isLoading && (
          <div className="flex justify-start">
            <div className="chat-bubble-agent flex items-center gap-1.5 py-3">
              <span className="w-1.5 h-1.5 rounded-full bg-gray-400 typing-dot" />
              <span className="w-1.5 h-1.5 rounded-full bg-gray-400 typing-dot" />
              <span className="w-1.5 h-1.5 rounded-full bg-gray-400 typing-dot" />
            </div>
          </div>
        )}

        {/* Escalation banner */}
        {isEscalated && (
          <div className="flex items-center gap-3 p-3 rounded-xl bg-amber-950/40 border border-amber-700/50">
            <AlertTriangle size={18} className="text-amber-400 shrink-0" />
            <p className="text-sm text-amber-300">
              This case has been escalated to our specialist team. They will reach out to you directly.
            </p>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-4 py-3 border-t border-gray-800 bg-gray-900/30">
        {isEscalated ? (
          <div className="text-center text-sm text-gray-500 py-2">
            Conversation escalated — awaiting specialist response
          </div>
        ) : (
          <div className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Type your message… (Enter to send)"
              rows={2}
              className="flex-1 resize-none bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-sm text-gray-100 
                         placeholder:text-gray-500 focus:outline-none focus:border-brand-500/60 transition-colors"
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || isLoading}
              className="btn-primary p-3 rounded-xl"
            >
              <Send size={16} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
