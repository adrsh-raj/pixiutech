import { useEffect, useMemo, useRef, useState } from "react"
import { Camera, CircleHelp, Mail, MessageCircle, Paperclip, Send, ShieldCheck, X } from "lucide-react"
import { apiFetch, useAuth } from "@/context/AuthContext"

const EMAIL = "director@pixiutech.com"
const WHATSAPP_NUMBER = "917985403186"
const MAX_IMAGE_BYTES = 3 * 1024 * 1024
const ALLOWED_MIME = new Set(["image/png", "image/jpeg", "image/webp"])
const ALLOWED_EXT = new Set([".png", ".jpg", ".jpeg", ".webp"])
const KIND_OPTIONS = [
  { value: "bug", label: "Bug / Problem" },
  { value: "help", label: "Help" },
  { value: "other", label: "Other" },
  { value: "philosophy", label: "Think / Rethink · Philosophy" },
] as const

function formatBytes(value: number) {
  if (value < 1024) return value + " B"
  if (value < 1024 * 1024) return (value / 1024).toFixed(1) + " KB"
  return (value / (1024 * 1024)).toFixed(2) + " MB"
}

function initialStudentId() {
  if (typeof window === "undefined") return ""
  try {
    return window.sessionStorage.getItem("pixiu_session_student_id")?.trim().toUpperCase() || ""
  } catch {
    return ""
  }
}

export function LabSupportWidget() {
  const [open, setOpen] = useState(false)
  const [studentId, setStudentId] = useState(initialStudentId)
  const { user } = useAuth()
  const [kind, setKind] = useState<"bug" | "help" | "other" | "philosophy">("bug")
  const [message, setMessage] = useState("")
  const [image, setImage] = useState<File | null>(null)
  const [dragging, setDragging] = useState(false)
  const [sending, setSending] = useState(false)
  const [status, setStatus] = useState<{ type: "success" | "error"; text: string } | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    const verifiedId = String(user?.related_id || user?.username || "").trim().toUpperCase()
    if (verifiedId) setStudentId(verifiedId)
  }, [user])

  useEffect(() => {
    if (!image) {
      setPreviewUrl(null)
      return undefined
    }
    const url = URL.createObjectURL(image)
    setPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [image])

  const imageMeta = useMemo(() => (image ? formatBytes(image.size) : null), [image])

  const validateImage = (file: File | undefined) => {
    if (!file) return null
    const dot = file.name.lastIndexOf(".")
    const ext = dot >= 0 ? file.name.slice(dot).toLowerCase() : ""
    if (!ALLOWED_EXT.has(ext) || !ALLOWED_MIME.has(String(file.type || "").toLowerCase())) {
      throw new Error("Only PNG, JPG/JPEG or WEBP images are accepted.")
    }
    if (file.size <= 0 || file.size > MAX_IMAGE_BYTES) {
      throw new Error("Attached image must be 3 MB or smaller.")
    }
    return file
  }

  const selectImage = (file: File | undefined) => {
    try {
      setImage(validateImage(file))
      setStatus(null)
    } catch (error) {
      setImage(null)
      if (inputRef.current) inputRef.current.value = ""
      setStatus({ type: "error", text: error instanceof Error ? error.message : "Invalid image." })
    }
  }

  const submit = async () => {
    const cleanId = studentId.trim().toUpperCase()
    const cleanMessage = message.trim()
    if (!cleanId) {
      setStatus({ type: "error", text: "Enter your Student ID first." })
      return
    }
    if (!cleanMessage) {
      setStatus({ type: "error", text: "Describe the bug or question so we can help." })
      return
    }

    setSending(true)
    setStatus(null)
    try {
      const form = new FormData()
      form.append("enquiry_type", kind)
      form.append("student_id", cleanId)
      form.append("message", cleanMessage)
      form.append("website", "")
      if (image) form.append("image", image, image.name)

      const response = await apiFetch("/public/enquiries", {
        method: "POST",
        body: form,
        cache: "no-store",
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || "We could not send the report right now.")

      setStatus({ type: "success", text: "Sent. Your report is now in the Pixiu enquiry inbox." })
      setMessage("")
      setImage(null)
      if (inputRef.current) inputRef.current.value = ""
    } catch (error) {
      setStatus({ type: "error", text: error instanceof Error ? error.message : "Network error. Please try again." })
    } finally {
      setSending(false)
    }
  }

  const contactMessage = "Hi Pixiu Tech, I need help with the Virtual Lab.\\nStudent ID: " + (studentId.trim().toUpperCase() || "—")
  const whatsappHref = "https://wa.me/" + WHATSAPP_NUMBER + "?text=" + encodeURIComponent(contactMessage)
  const emailHref = "mailto:" + EMAIL + "?subject=" + encodeURIComponent("PIXIU LAB HELP") + "&body=" + encodeURIComponent(contactMessage)

  return (
    <>
      <button
        type="button"
        onClick={() => { setOpen(value => !value); setStatus(null) }}
        className="fixed bottom-20 right-4 z-[70] inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-[#0b1220]/95 px-3.5 py-2.5 text-xs font-bold text-white shadow-xl backdrop-blur-md transition hover:border-cyan-300/60 hover:bg-[#101a2d] md:bottom-6"
        aria-expanded={open}
        aria-controls="pixiu-lab-support-panel"
      >
        <CircleHelp size={15} className="text-cyan-300" />
        <span className="hidden sm:inline">Lab Help</span>
      </button>

      {open && (
        <section
          id="pixiu-lab-support-panel"
          aria-label="Pixiu Virtual Lab support"
          className="fixed bottom-32 right-4 z-[71] w-[min(92vw,390px)] overflow-hidden rounded-2xl border border-slate-700 bg-[#08111f] text-white shadow-2xl shadow-black/50 md:bottom-20"
        >
          <header className="border-b border-slate-800 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-300">PIXIU SUPPORT</p>
                <h2 className="mt-1 text-base font-black">Found a bug or need help?</h2>
                <p className="mt-1 text-[11px] leading-5 text-slate-400">Send it directly to the Pixiu enquiry inbox.</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-800 hover:text-white" aria-label="Close support panel">
                <X size={16} />
              </button>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2">
              <a href={emailHref} className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-[11px] font-bold text-slate-200 transition hover:border-slate-500 hover:bg-slate-800">
                <Mail size={13} /> Email
              </a>
              <a href={whatsappHref} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-3 py-2 text-[11px] font-bold text-emerald-200 transition hover:bg-emerald-500/15">
                <MessageCircle size={13} /> WhatsApp
              </a>
            </div>
            <p className="mt-2 text-[10px] text-slate-500">{EMAIL} · +91 7985403186</p>
          </header>

          <div className="space-y-3 p-4">
            <label className="block">
              <span className="mb-1.5 block text-[10px] font-black uppercase tracking-wide text-slate-500">Your Pixiu ID</span>
              <input value={studentId} readOnly placeholder="Your Pixiu ID" maxLength={80} autoComplete="off" aria-readonly="true" className="w-full cursor-not-allowed rounded-xl border border-slate-700 bg-slate-950/80 px-3 py-2.5 text-xs font-semibold text-slate-300 outline-none" />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-[10px] font-black uppercase tracking-wide text-slate-500">Category</span>
              <select value={kind} onChange={event => setKind(event.target.value as "bug" | "help" | "other" | "philosophy")} className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-xs font-semibold text-white outline-none focus:border-cyan-400">
                {KIND_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>

            <label className="block">
              <span className="mb-1.5 block text-[10px] font-black uppercase tracking-wide text-slate-500">Description</span>
              <textarea value={message} onChange={event => setMessage(event.target.value.slice(0, 4000))} rows={5} maxLength={4000} placeholder="What happened? What did you expect?" className="w-full resize-none rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-xs leading-5 text-white outline-none focus:border-cyan-400" />
            </label>

            <div
              className={"rounded-xl border border-dashed p-3 transition " + (dragging ? "border-cyan-400 bg-cyan-500/5" : "border-slate-700 bg-slate-950/40")}
              onDragOver={event => { event.preventDefault(); setDragging(true) }}
              onDragLeave={() => setDragging(false)}
              onDrop={event => { event.preventDefault(); setDragging(false); selectImage(event.dataTransfer.files?.[0]) }}
            >
              <input
                ref={inputRef}
                type="file"
                accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={event => selectImage(event.target.files?.[0])}
              />
              <button type="button" onClick={() => inputRef.current?.click()} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[11px] font-bold text-slate-300 transition hover:bg-slate-900">
                <Camera size={14} className="text-cyan-300" />
                <span className="truncate">{image ? image.name : "Attach image (optional)"}</span>
              </button>
              <p className="mt-1 flex items-center gap-1 text-[9px] leading-4 text-slate-500">
                <Paperclip size={10} /> PNG/JPG/JPEG/WEBP · max 3 MB · images only
              </p>
              {imageMeta && <div className="mt-2 flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-950/70 p-1.5">
                {previewUrl ? <img src={previewUrl} alt="" className="h-10 w-14 shrink-0 rounded-md border border-slate-700 object-cover" /> : null}
                <div className="min-w-0">
                  <p className="truncate text-[9px] font-semibold text-emerald-300">{imageMeta}</p>
                  <p className="text-[9px] text-slate-600">Small preview · original image is uploaded securely</p>
                </div>
              </div>}
            </div>

            <button type="button" onClick={() => void submit()} disabled={sending} className="flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-500 px-3 py-2.5 text-xs font-black text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-50">
              <Send size={14} /> {sending ? "Sending…" : "Send to Pixiu"}
            </button>

            {status && (
              <div
                className={"rounded-xl border px-3 py-2 text-[10px] leading-4 " + (status.type === "success" ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-200" : "border-red-500/25 bg-red-500/10 text-red-200")}
                role="status"
                aria-live="polite"
              >
                <div className="flex items-start gap-2">
                  <ShieldCheck size={12} className={status.type === "success" ? "text-emerald-300" : "text-red-300"} />
                  <span>{status.text}</span>
                </div>
              </div>
            )}

            <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-2.5 text-[9px] leading-4 text-slate-500">
              PNG, JPG/JPEG or WEBP only · 3 MB max. Files are checked for type, image validity and malware before storage.
            </div>
          </div>
        </section>
      )}
    </>
  )
}
