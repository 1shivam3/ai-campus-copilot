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
  "Explain binary tree traversal from my uploaded notes.",
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
      content: text,
      created_at: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, optimisticUserMsg])
    setSending(true)

    try {
      const res = await sendCopilotMessage({
        message: text,
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
            title: text.slice(0, 32) + (text.length > 32 ? "..." : ""),
            updated_at: new Date().toISOString(),
          }
          setConversations((prev) => [newConvItem, ...prev.filter((c) => c.id !== res.conversation_id)])
        }
      }
    } catch (err) {
      console.error("Copilot message error:", err)
      setError(err.message || "Failed to reach AI Copilot. Please try again.")
    } finally {
      setSending(false)
    }
  }

  // ---------------------------------------------------------
  // 4. NEW CONVERSATION & DELETE CONVERSATION
  // ---------------------------------------------------------
  function handleNewChat() {
    setActiveConversationId(null)
    setMessages([])
    setError("")
    setSidebarOpen(false)
    textareaRef.current?.focus()
  }

  async function handleDeleteConversation(convId, e) {
    e.stopPropagation()
    if (!user?.id || !convId) return

    try {
      await supabase.from("copilot_conversations").delete().eq("id", convId).eq("user_id", user.id)

      const updated = conversations.filter((c) => c.id !== convId)
      setConversations(updated)

      if (activeConversationId === convId) {
        if (updated.length > 0) {
          setActiveConversationId(updated[0].id)
        } else {
          handleNewChat()
        }
      }
    } catch (err) {
      console.warn("Delete conversation error:", err)
    }
  }

  // ---------------------------------------------------------
  // 5. ACTION BUTTON HANDLER
  // ---------------------------------------------------------
  function handleExecuteAction(action) {
    if (!action?.type) return

    switch (action.type) {
      case "start_focus":
      case "open_task":
        if (onNavigate) onNavigate("Tasks")
        break
      case "open_exam_mode":
        if (onOpenExamMode) {
          onOpenExamMode()
        } else if (onNavigate) {
          onNavigate("Exam Mode")
        }
        break
      case "open_timetable":
        if (onNavigate) onNavigate("My Academics")
        break
      case "open_progress":
      case "open_syllabus":
      case "open_study_material":
        if (onNavigate) onNavigate("Syllabus")
        break
      case "open_attendance":
        if (onNavigate) onNavigate("My Academics")
        break
      case "open_exams":
        if (onNavigate) onNavigate("Exams")
        break
      default:
        if (onNavigate) onNavigate("Home")
        break
    }
  }

  const studentFirstName = profile?.full_name?.split(" ")[0] || "Student"

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col lg:flex-row bg-[#f8fafc] overflow-hidden">
      {/* MOBILE CONVERSATION DRAWER BACKDROP */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-950/50 backdrop-blur-xs lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* CONVERSATION HISTORY SIDEBAR */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-slate-200 bg-white transition-transform duration-200 lg:static lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between border-b border-slate-100 p-4">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600 text-white font-bold text-xs">
              🤖
            </span>
            <span className="text-sm font-bold text-slate-900">Copilot Chats</span>
          </div>

          <button
            type="button"
            onClick={handleNewChat}
            className="flex items-center gap-1 rounded-xl bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700 hover:bg-blue-100 transition shadow-2xs"
            title="Start new conversation"
          >
            <span>+ New</span>
          </button>
        </div>

        {/* Conversation List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          {conversations.length === 0 ? (
            <p className="p-4 text-center text-xs text-slate-400">
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
                      ? "bg-slate-900 text-white shadow-xs"
                      : "text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  <span className="truncate flex-1 pr-2">
                    💬 {conv.title || "Academic Chat"}
                  </span>

                  <button
                    type="button"
                    onClick={(e) => handleDeleteConversation(conv.id, e)}
                    className={`rounded-md p-1 opacity-0 group-hover:opacity-100 hover:bg-white/20 transition ${
                      isActive ? "text-slate-300 hover:text-white" : "text-slate-400 hover:text-red-600"
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
        <div className="border-t border-slate-100 p-3 bg-slate-50/70 text-[11px] text-slate-500 font-medium">
          <div className="flex items-center justify-between">
            <span>Context: Sem {profile?.semester || "3"} {profile?.section || ""}</span>
            <span className="inline-block h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          </div>
        </div>
      </aside>

      {/* MAIN CHAT AREA */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top Chat Header */}
        <header className="flex items-center justify-between border-b border-slate-200/90 bg-white px-4 sm:px-6 py-3 shadow-xs">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="rounded-xl border border-slate-200 p-1.5 text-slate-700 hover:bg-slate-100 lg:hidden"
              aria-label="Open conversation menu"
            >
              💬
            </button>

            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm sm:text-base font-bold text-slate-900">
                  AI Study Copilot
                </h1>
                <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700 uppercase">
                  Connected to Academic Data
                </span>
              </div>
              <p className="text-[11px] text-slate-500 hidden sm:block">
                Grounded in your timetable, syllabus mastery, exams, tasks, and next best action.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleNewChat}
              className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition shadow-2xs"
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
                <span className="flex h-14 w-14 items-center justify-center rounded-3xl bg-linear-to-br from-blue-600 to-indigo-600 text-white font-bold text-2xl shadow-md">
                  ✨
                </span>
              </div>

              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
                  How can I help you today, {studentFirstName}?
                </h2>
                <p className="mt-1.5 text-xs sm:text-sm text-slate-500 max-w-md mx-auto leading-relaxed">
                  I have live access to your semester schedule, weak syllabus topics, upcoming exams, and uploaded study notes.
                </p>
              </div>

              {/* Starter Suggestions Chips */}
              <div className="space-y-2">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  TRY ASKING
                </p>
                <div className="grid gap-2 sm:grid-cols-2 text-left">
                  {STARTER_PROMPTS.map((promptText, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => handleSendMessage(promptText)}
                      className="rounded-2xl border border-slate-200/90 bg-white p-3 text-xs font-semibold text-slate-800 hover:border-blue-300 hover:bg-blue-50/50 hover:text-blue-700 transition shadow-2xs"
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
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-white text-xs font-bold shadow-xs">
                    🤖
                  </span>
                )}

                <div
                  className={`max-w-[85%] sm:max-w-xl rounded-3xl p-4 sm:p-5 shadow-xs ${
                    isUser
                      ? "bg-blue-600 text-white rounded-br-xs"
                      : "bg-white border border-slate-200/90 text-slate-900 rounded-bl-xs"
                  }`}
                >
                  {/* Message Content */}
                  <div className="text-xs sm:text-sm whitespace-pre-wrap leading-relaxed">
                    {msg.content}
                  </div>

                  {/* Sources Attribution */}
                  {msg.sources && msg.sources.length > 0 && (
                    <div className="mt-3 border-t border-slate-100 pt-2 flex flex-wrap gap-1.5">
                      {msg.sources.map((src, sIdx) => (
                        <button
                          key={sIdx}
                          type="button"
                          onClick={() => src.material_id && onOpenReader && onOpenReader(src.material_id)}
                          className="inline-flex items-center gap-1 rounded-lg bg-indigo-50 border border-indigo-200 px-2 py-0.5 text-[10px] font-bold text-indigo-700 hover:bg-indigo-100 transition"
                        >
                          <span>📄</span>
                          <span>{src.title} · Pg {src.page_number} ↗</span>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Structured Action Buttons */}
                  {msg.actions && msg.actions.length > 0 && (
                    <div className="mt-3 border-t border-slate-100 pt-3 flex flex-wrap gap-2">
                      {msg.actions.map((act, aIdx) => (
                        <button
                          key={aIdx}
                          type="button"
                          onClick={() => handleExecuteAction(act)}
                          className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3.5 py-1.5 text-xs font-bold text-white shadow-2xs hover:bg-slate-800 transition active:scale-[0.98]"
                        >
                          <span>{act.label || "Take Action →"}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {isUser && (
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl bg-slate-200 font-bold text-xs text-slate-700">
                    {studentFirstName[0]}
                  </span>
                )}
              </div>
            )
          })}

          {/* Assistant Typing Indicator */}
          {sending && (
            <div className="flex gap-3 justify-start">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-white text-xs font-bold shadow-xs">
                🤖
              </span>
              <div className="rounded-3xl border border-slate-200/90 bg-white p-4 text-xs font-medium text-slate-500 shadow-xs flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-blue-600 animate-bounce" />
                <span className="h-2 w-2 rounded-full bg-blue-600 animate-bounce delay-100" />
                <span className="h-2 w-2 rounded-full bg-blue-600 animate-bounce delay-200" />
                <span>Checking your academic context...</span>
              </div>
            </div>
          )}

          {/* Error Banner */}
          {error && (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-xs font-semibold text-red-700">
              ⚠️ {error}
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Fixed Input Bar */}
        <div className="border-t border-slate-200 bg-white p-3 sm:p-4">
          <form
            onSubmit={(e) => {
              e.preventDefault()
              handleSendMessage()
            }}
            className="mx-auto max-w-4xl flex items-end gap-2 rounded-2xl border border-slate-300 bg-slate-50/80 p-1.5 focus-within:border-blue-500 focus-within:bg-white transition shadow-2xs"
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
              className="flex-1 resize-none bg-transparent px-3 py-2 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 outline-none max-h-28 disabled:opacity-60"
            />

            <button
              type="submit"
              disabled={sending || !inputMessage.trim() || isOffline}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white font-bold transition hover:bg-blue-700 disabled:opacity-30 disabled:hover:bg-blue-600 shadow-xs active:scale-95"
              aria-label="Send message"
            >
              {sending ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : (
                <span>↑</span>
              )}
            </button>
          </form>

          <p className="mt-1 text-center text-[10px] text-slate-400 font-medium">
            AI Study Copilot answers strictly using your verified schedule, mastery scores, and uploaded materials.
          </p>
        </div>
      </div>
    </div>
  )
}

export default CopilotChat
