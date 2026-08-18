import { useEffect, useState, useRef } from "react"
import { supabase } from "../lib/supabase"
import { sendCopilotMessage } from "../lib/api"
import EmptyState from "../components/EmptyState"
import ErrorState from "../components/ErrorState"

const STARTER_PROMPTS = [
  "What should I study today?",
  "What classes do I have today?",
  "Why is my exam readiness low?",
  "What should I revise before my next exam?",
  "Explain my weakest syllabus topic.",
  "I have 45 minutes free. What should I do?",
  "What did I miss yesterday? Give me a recovery plan.",
  "Explain binary tree traversal from my course concepts.",
]

function CopilotChat({
  user,
  profile,
  onNavigate,
  onStartSession,
  onOpenReader,
  onOpenExamMode,
}) {
  // Conversations & Chat State
  const [conversations, setConversations] = useState([])
  const [activeConversationId, setActiveConversationId] = useState(null)
  const [messages, setMessages] = useState([])
  const [inputMessage, setInputMessage] = useState("")
  const [sending, setSending] = useState(false)
  const [loadingHistory, setLoadingHistory] = useState(true)
  const [error, setError] = useState("")
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const messagesEndRef = useRef(null)
  const textareaRef = useRef(null)

  // ---------------------------------------------------------
  // 1. LOAD CONVERSATIONS LIST
  // ---------------------------------------------------------
  useEffect(() => {
    async function loadConversations() {
      if (!user?.id) return
      setLoadingHistory(true)
      try {
        const { data, error: convErr } = await supabase
          .from("copilot_conversations")
          .select("id, title, updated_at, created_at")
          .eq("user_id", user.id)
          .order("updated_at", { ascending: false })

        if (convErr) throw convErr

        const convList = data || []
        setConversations(convList)

        if (convList.length > 0 && !activeConversationId) {
          setActiveConversationId(convList[0].id)
        }
      } catch (err) {
        console.warn("Could not load conversations:", err)
      } finally {
        setLoadingHistory(false)
      }
    }

    loadConversations()
  }, [user])

  // ---------------------------------------------------------
  // 2. LOAD MESSAGES FOR ACTIVE CONVERSATION
  // ---------------------------------------------------------
  useEffect(() => {
    async function loadMessages() {
      if (!activeConversationId || !user?.id) {
        setMessages([])
        return
      }

      try {
        const { data, error: msgErr } = await supabase
          .from("copilot_messages")
          .select("id, role, content, actions, sources, created_at")
          .eq("conversation_id", activeConversationId)
          .order("created_at", { ascending: true })

        if (msgErr) throw msgErr
        setMessages(data || [])
      } catch (err) {
        console.warn("Could not load messages:", err)
      }
    }

    loadMessages()
  }, [activeConversationId, user])

  // Scroll to bottom on new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, sending])

  // ---------------------------------------------------------
  // 3. SEND MESSAGE TO COPILOT
  // ---------------------------------------------------------
  const isOffline = typeof navigator !== "undefined" && !navigator.onLine

  async function handleSendMessage(msgText = inputMessage) {
    const textToSend = (msgText || "").trim()
    if (!textToSend || sending || !user?.id) return

    if (isOffline) {
      setError("You're offline. Connect to the internet to chat with AI Copilot.")
      return
    }

    setInputMessage("")
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto"
    }
    setError("")

    // Optimistic user message in UI
    const optimisticUserMsg = {
      id: `temp-${Date.now()}`,
      role: "user",
      content: textToSend,
      created_at: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, optimisticUserMsg])
    setSending(true)

    try {
      const res = await sendCopilotMessage({
        message: textToSend,
        userId: user.id,
        conversationId: activeConversationId,
      })

      if (res?.message) {
        const newAssistantMsg = {
          id: `resp-${Date.now()}`,
          role: "assistant",
          content: res.message,
          actions: res.actions || [],
          sources: res.sources || [],
          created_at: new Date().toISOString(),
        }

        setMessages((prev) => [...prev, newAssistantMsg])

        // If a new conversation was created on backend
        if (res.conversation_id && res.conversation_id !== activeConversationId) {
          setActiveConversationId(res.conversation_id)
          const newConvItem = {
            id: res.conversation_id,
            title: textToSend.slice(0, 32) + (textToSend.length > 32 ? "..." : ""),
            updated_at: new Date().toISOString(),
          }
          setConversations((prev) => [newConvItem, ...prev.filter((c) => c.id !== res.conversation_id)])
        }
      }
    } catch (err) {
      console.error(err)
      setError("Copilot encountered an error. Please retry.")
    } finally {
      setSending(false)
    }
  }

  // ---------------------------------------------------------
  // 4. ACTION HANDLERS
  // ---------------------------------------------------------
  function handleExecuteAction(action) {
    if (!action) return

    if (action.type === "start_session") {
      if (onStartSession) {
        onStartSession(action.payload?.topic_name, action.payload?.duration_minutes)
      } else if (onNavigate) {
        onNavigate("Exam Mode")
      }
    } else if (action.type === "open_exam_mode" || action.type === "open_quiz") {
      if (onOpenExamMode) {
        onOpenExamMode(action.payload?.exam_id)
      } else if (onNavigate) {
        onNavigate("Exam Mode")
      }
    } else if (action.type === "navigate" && onNavigate) {
      onNavigate(action.payload?.page || "Home")
    }
  }

  async function handleNewChat() {
    setActiveConversationId(null)
    setMessages([])
    setSidebarOpen(false)
  }

  async function handleDeleteConversation(convId, e) {
    e.stopPropagation()
    if (!window.confirm("Delete this conversation history?")) return

    try {
      setConversations((prev) => prev.filter((c) => c.id !== convId))
      if (activeConversationId === convId) {
        setActiveConversationId(null)
        setMessages([])
      }

      await supabase.from("copilot_conversations").delete().eq("id", convId).eq("user_id", user.id)
    } catch (err) {
      console.error(err)
    }
  }

  const studentFirstName = profile?.full_name?.split(" ")[0] || "Student"

  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden bg-[#F7F7F2] dark:bg-[#0f1416]">
      {/* MOBILE SIDEBAR BACKDROP */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-[#18181B]/50 backdrop-blur-xs lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* CONVERSATIONS SIDEBAR */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 border-r border-[#E4E4E7] bg-white transition-transform duration-200 lg:static lg:block dark:border-[#27343a] dark:bg-[#141c1f] ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        {/* Sidebar Header */}
        <div className="flex items-center justify-between border-b border-[#E4E4E7] p-4 dark:border-[#27343a]">
          <h2 className="text-xs font-bold uppercase tracking-wider text-[#18181B] dark:text-[#f4f4f5]">
            Chat History
          </h2>
          <button
            type="button"
            onClick={handleNewChat}
            className="rounded-xl bg-[#0F766E] px-2.5 py-1 text-xs font-bold text-white shadow-2xs hover:bg-[#115E59] transition"
          >
            + New
          </button>
        </div>

        {/* Conversations List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {conversations.length === 0 ? (
            <p className="p-4 text-center text-xs text-[#71717A] dark:text-[#a1a1aa]">
              No conversations yet. Start a new chat below!
            </p>
          ) : (
            conversations.map((conv) => {
              const isActive = activeConversationId === conv.id
              return (
                <div
                  key={conv.id}
                  onClick={() => {
                    setActiveConversationId(conv.id)
                    setSidebarOpen(false)
                  }}
                  className={`group flex cursor-pointer items-center justify-between rounded-xl px-3 py-2.5 text-xs font-semibold transition ${
                    isActive
                      ? "bg-[#ECFDF5] text-[#12312F] border-l-2 border-[#0F766E] shadow-2xs dark:bg-[#182226] dark:text-[#2DD4BF] dark:border-[#2DD4BF]"
                      : "text-[#52525B] hover:bg-[#F7F7F2] hover:text-[#18181B] dark:text-[#a1a1aa] dark:hover:bg-[#182226] dark:hover:text-white"
                  }`}
                >
                  <span className="truncate flex-1 pr-2">
                    💬 {conv.title || "Academic Chat"}
                  </span>

                  <button
                    type="button"
                    onClick={(e) => handleDeleteConversation(conv.id, e)}
                    className={`rounded-md p-1 opacity-0 group-hover:opacity-100 hover:bg-white/20 transition ${
                      isActive ? "text-[#52525B] hover:text-[#18181B] dark:text-[#a1a1aa]" : "text-[#71717A] hover:text-[#DC2626]"
                    }`}
                    title="Delete conversation"
                  >
                    🗑️
                  </button>
                </div>
              )
            })
          )}
        </div>

        {/* Sidebar Footer Context Indicator */}
        <div className="border-t border-[#E4E4E7] p-3 bg-[#F7F7F2] text-[11px] text-[#52525B] font-medium dark:border-[#27343a] dark:bg-[#182226] dark:text-[#a1a1aa]">
          <div className="flex items-center justify-between">
            <span>Context: Sem {profile?.semester || "3"} {profile?.section || ""}</span>
            <span className="inline-block h-2 w-2 rounded-full bg-[#15803D] animate-pulse" />
          </div>
        </div>
      </aside>

      {/* MAIN CHAT AREA */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top Chat Header */}
        <header className="flex items-center justify-between border-b border-[#E4E4E7] bg-white px-4 sm:px-6 py-3 shadow-2xs dark:border-[#27343a] dark:bg-[#141c1f]">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="rounded-xl border border-[#E4E4E7] p-1.5 text-[#52525B] hover:bg-[#F7F7F2] lg:hidden dark:border-[#27343a] dark:text-[#a1a1aa] dark:hover:bg-[#182226]"
              aria-label="Open conversation menu"
            >
              💬
            </button>

            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm sm:text-base font-bold text-[#18181B] dark:text-[#f4f4f5]">
                  AI Study Copilot
                </h1>
                <span className="rounded-full bg-[#ECFDF5] px-2 py-0.5 text-[10px] font-bold text-[#0F766E] uppercase border border-teal-200/60 dark:bg-[#182226] dark:border-[#2DD4BF]/30 dark:text-[#2DD4BF]">
                  Connected to Academic Data
                </span>
              </div>
              <p className="text-[11px] text-[#52525B] hidden sm:block dark:text-[#a1a1aa]">
                Grounded in your timetable, syllabus mastery, exams, tasks, and next best action.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleNewChat}
              className="rounded-xl border border-[#E4E4E7] bg-white px-3 py-1.5 text-xs font-bold text-[#18181B] hover:bg-[#F7F7F2] transition shadow-2xs dark:border-[#27343a] dark:bg-[#182226] dark:text-[#f4f4f5]"
            >
              + New Chat
            </button>
          </div>
        </header>

        {/* Messages Scroll Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {/* Welcome Screen / Empty Chat State */}
          {messages.length === 0 && (
            <div className="mx-auto max-w-2xl py-6 sm:py-10 text-center space-y-6">
              <div className="flex justify-center">
                <span className="flex h-14 w-14 items-center justify-center rounded-3xl bg-[#12312F] text-white font-bold text-2xl shadow-md border border-[#0F766E]/40">
                  ✦
                </span>
              </div>

              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-[#18181B] dark:text-[#f4f4f5]">
                  How can I help you today, {studentFirstName}?
                </h2>
                <p className="mt-1.5 text-xs sm:text-sm text-[#52525B] max-w-md mx-auto leading-relaxed dark:text-[#a1a1aa]">
                  I have live access to your semester schedule, weak syllabus topics, upcoming exams, and coursework priorities.
                </p>
              </div>

              {/* Starter Suggestions Chips */}
              <div className="space-y-2">
                <p className="text-[11px] font-bold uppercase tracking-wider text-[#71717A] dark:text-[#a1a1aa]">
                  TRY ASKING
                </p>
                <div className="grid gap-2 sm:grid-cols-2 text-left">
                  {STARTER_PROMPTS.map((promptText, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => handleSendMessage(promptText)}
                      className="rounded-2xl border border-[#E4E4E7] bg-white p-3 text-xs font-semibold text-[#18181B] hover:border-[#0F766E] hover:bg-[#ECFDF5]/50 hover:text-[#0F766E] transition shadow-2xs dark:border-[#27343a] dark:bg-[#141c1f] dark:text-[#f4f4f5] dark:hover:bg-[#182226] dark:hover:text-[#2DD4BF]"
                    >
                      ✦ {promptText}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Messages Stream */}
          {messages.map((msg, idx) => {
            const isUser = msg.role === "user"

            return (
              <div
                key={msg.id || idx}
                className={`flex gap-3 ${isUser ? "justify-end" : "justify-start"}`}
              >
                {!isUser && (
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl bg-[#0F766E] text-white text-xs font-bold shadow-2xs">
                    ✦
                  </span>
                )}

                <div
                  className={`max-w-[85%] sm:max-w-xl rounded-3xl p-4 sm:p-5 shadow-2xs ${
                    isUser
                      ? "bg-[#0F766E] text-white rounded-br-xs"
                      : "bg-white border border-[#E4E4E7] text-[#18181B] rounded-bl-xs dark:border-[#27343a] dark:bg-[#141c1f] dark:text-[#f4f4f5]"
                  }`}
                >
                  {/* Message Content */}
                  <div className="text-xs sm:text-sm whitespace-pre-wrap leading-relaxed">
                    {msg.content}
                  </div>

                  {/* Sources Attribution */}
                  {msg.sources && msg.sources.length > 0 && (
                    <div className="mt-3 border-t border-[#E4E4E7] pt-2 flex flex-wrap gap-1.5 dark:border-[#27343a]">
                      {msg.sources.map((src, sIdx) => (
                        <button
                          key={sIdx}
                          type="button"
                          onClick={() => src.material_id && onOpenReader && onOpenReader(src.material_id)}
                          className="inline-flex items-center gap-1 rounded-lg bg-[#ECFDF5] border border-teal-200 px-2 py-0.5 text-[10px] font-bold text-[#0F766E] hover:bg-teal-100 transition dark:bg-[#182226] dark:border-[#2DD4BF]/30 dark:text-[#2DD4BF]"
                        >
                          <span>📄</span>
                          <span>{src.title} · Pg {src.page_number} ↗</span>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Structured Action Buttons */}
                  {msg.actions && msg.actions.length > 0 && (
                    <div className="mt-3 border-t border-[#E4E4E7] pt-3 flex flex-wrap gap-2 dark:border-[#27343a]">
                      {msg.actions.map((act, aIdx) => (
                        <button
                          key={aIdx}
                          type="button"
                          onClick={() => handleExecuteAction(act)}
                          className="inline-flex items-center gap-1.5 rounded-xl bg-[#12312F] px-3.5 py-1.5 text-xs font-bold text-white shadow-2xs hover:bg-[#0F766E] transition active:scale-[0.98] dark:bg-[#2DD4BF] dark:text-[#0f1416]"
                        >
                          <span>{act.label || "Take Action →"}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {isUser && (
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl bg-[#12312F] font-bold text-xs text-white">
                    {studentFirstName[0]}
                  </span>
                )}
              </div>
            )
          })}

          {/* Assistant Typing Indicator */}
          {sending && (
            <div className="flex gap-3 justify-start">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl bg-[#0F766E] text-white text-xs font-bold shadow-2xs">
                ✦
              </span>
              <div className="rounded-3xl border border-[#E4E4E7] bg-white p-4 text-xs font-medium text-[#52525B] shadow-2xs flex items-center gap-2 dark:border-[#27343a] dark:bg-[#141c1f] dark:text-[#a1a1aa]">
                <span className="h-2 w-2 rounded-full bg-[#0F766E] animate-bounce" />
                <span className="h-2 w-2 rounded-full bg-[#0F766E] animate-bounce delay-100" />
                <span className="h-2 w-2 rounded-full bg-[#0F766E] animate-bounce delay-200" />
                <span>Checking your academic context...</span>
              </div>
            </div>
          )}

          {/* Error Banner */}
          {error && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs font-semibold text-[#DC2626]">
              ⚠️ {error}
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Fixed Input Bar */}
        <div className="border-t border-[#E4E4E7] bg-white p-3 sm:p-4 dark:border-[#27343a] dark:bg-[#141c1f]">
          <form
            onSubmit={(e) => {
              e.preventDefault()
              handleSendMessage()
            }}
            className="mx-auto max-w-4xl flex items-end gap-2 rounded-2xl border border-[#E4E4E7] bg-[#F7F7F2] p-1.5 focus-within:border-[#0F766E] focus-within:bg-white transition shadow-2xs dark:border-[#27343a] dark:bg-[#182226] dark:focus-within:bg-[#141c1f]"
          >
            <textarea
              ref={textareaRef}
              rows={1}
              value={inputMessage}
              disabled={sending || isOffline}
              onChange={(e) => {
                setInputMessage(e.target.value)
                e.target.style.height = "auto"
                e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault()
                  handleSendMessage()
                }
              }}
              placeholder={
                isOffline
                  ? "AI Copilot requires an internet connection (You're currently offline)"
                  : "Ask your Copilot anything about your academics... (Enter to send)"
              }
              className="flex-1 resize-none bg-transparent px-3 py-2 text-xs sm:text-sm text-[#18181B] placeholder:text-[#71717A] outline-none max-h-28 disabled:opacity-60 dark:text-[#f4f4f5] dark:placeholder:text-[#71717a]"
            />

            <button
              type="submit"
              disabled={sending || !inputMessage.trim() || isOffline}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#0F766E] text-white font-bold transition hover:bg-[#115E59] disabled:opacity-30 disabled:hover:bg-[#0F766E] shadow-2xs active:scale-95"
              aria-label="Send message"
            >
              {sending ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : (
                <span>↑</span>
              )}
            </button>
          </form>

          <p className="mt-1 text-center text-[10px] text-[#71717A] font-medium dark:text-[#71717a]">
            AI Study Copilot answers strictly using your verified schedule, mastery scores, and course records.
          </p>
        </div>
      </div>
    </div>
  )
}

export default CopilotChat
