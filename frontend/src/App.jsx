import React, { useMemo, useRef, useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, ChevronRight, ChevronLeft, Download, Trash2, Lock, ClipboardList } from "lucide-react";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "";
const ADMIN_TOKEN_FE = import.meta.env.VITE_ADMIN_TOKEN || "";

const ADMIN_PIN = "7788"; // client-side gate (UI), real protection is via ADMIN_TOKEN on backend

const questions = [
  { id: "A1", title: "Kim uchun oldingiz?", type: "single", required: true, options: ["O‘zim","Oilam","Sovg‘a","Ofis","Boshqa (yozing)"] },
  { id: "A2", title: "Qaysi holatga mos oldingiz?", type: "multi", required: true, options: ["Nonushta","Choy/qahva","Bayram","Sovg‘a","Kechki desert"] },
  { id: "C6", title: "Shirinlik darajasi", subtitle: "(1–5)", type: "scale", required: true, min: 1, max: 5 },
  { id: "C7", title: "Dolchin (tarçin) darajasi", subtitle: "(1–5)", type: "scale", required: true, min: 1, max: 5 },
  { id: "C8", title: "Xamir yumshoqligi / markaz ‘gooey’ligi", subtitle: "(1–5)", type: "scale", required: true, min: 1, max: 5 },
  { id: "C9", title: "O‘lcham sizga qanday?", type: "single", required: true, options: ["Mini","Klassik","Katta","Farqi yo‘q"] },
  { id: "C10", title: "Qanday holatda berilsin?", subtitle: "Issiq yoki xona harorati", type: "single", required: true, options: ["Issiq","Xona harorati"] },
  { id: "D11", title: "Qaysi ta’mlarni xohlaysiz?", type: "multi", required: true, options: ["Karamel","Shokolad","Pista","Yong‘oq","Oreo","Mevali","Shakari kam","Boshqa (yozing)"] },
  { id: "D12", title: "Yonida alohida karamel stakancha (+2 000 so‘m) qiziqmi?", type: "single", required: true, options: ["Ha","Yo‘q"] },
  { id: "G20", title: "Qaysi narxda ‘arzon, yaxshi narx’ deb hisoblaysiz?", subtitle: "(so‘m)", type: "number", required: true },
  { id: "G22", title: "Qaysi narxda ‘haddan tashqari qimmat, olmayman’ deysiz?", subtitle: "(so‘m)", type: "number", required: true },
  { id: "H25", title: "Qayta buyurtma qilish ehtimoli", subtitle: "(0–10)", type: "scale", required: true, min: 0, max: 10 },
  { id: "I27", title: "Qaysi setni xohlaysiz?", type: "single", required: true, options: ["4 dona","6 dona","12 dona","Aralash mini"] },
];

const palette = {
  bg: "#FFF8F2",
  card: "#FFF3E9",
  accent: "#E76F51",
  accentDark: "#C25438",
  teal: "#2A9D8F",
  choco: "#8B4513",
};

export default function App() {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState({});
  const [showAdmin, setShowAdmin] = useState(false);
  const [adminUnlocked, setAdminUnlocked] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const totalQuestions = questions.length;
  const atReview = step === totalQuestions;

  const answeredCount = useMemo(() => {
    let c = 0;
    for (const q of questions) {
      const v = answers[q.id];
      if (q.type === "multi") {
        if (Array.isArray(v) && v.length > 0) c++;
      } else if (v !== undefined && v !== null && v !== "") {
        c++;
      }
    }
    return c;
  }, [answers]);

  // 3D tilt
  const cardRef = useRef(null);
  const [tilt, setTilt] = useState({ rx: 0, ry: 0 });
  const onMouseMoveCard = (e) => {
    const el = cardRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const rx = ((y / rect.height) - 0.5) * -6;
    const ry = ((x / rect.width) - 0.5) * 6;
    setTilt({ rx, ry });
  };
  const onMouseLeaveCard = () => setTilt({ rx: 0, ry: 0 });

  const currentQ = questions[step];

  const canNext = useMemo(() => {
    if (atReview) return true;
    const q = currentQ;
    if (!q) return false;
    const v = answers[q.id];
    if (!q.required) return true;
    if (q.type === "multi") return Array.isArray(v) && v.length > 0;
    if (q.type === "number") return v !== undefined && v !== null && v !== "" && !isNaN(Number(v));
    if (q.type === "scale") return typeof v === "number" && v >= (q.min ?? 0) && v <= (q.max ?? 10);
    return v !== undefined && v !== null && v !== "";
  }, [answers, atReview, currentQ]);

  function goNext() { if (step < totalQuestions) setStep((s) => s + 1); }
  function goPrev() { if (step > 0) setStep((s) => s - 1); }
  function updateAnswer(id, value) { setAnswers((a) => ({ ...a, [id]: value })); }

  async function submitAll() {
    setLoading(true); setErr("");
    try {
      const res = await fetch(`${API_BASE}/api/v1/responses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...answers, meta: { ua: navigator.userAgent, lang: navigator.language || "" } }),
      });
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      await res.json();
      setStep(totalQuestions + 1);
    } catch (e) {
      console.error(e);
      setErr("Yuborishda xatolik. Keyinroq urinib ko‘ring.");
    } finally {
      setLoading(false);
    }
  }

  async function loadAdmin() {
    setLoading(true); setErr("");
    try {
      const res = await fetch(`${API_BASE}/api/v1/responses?limit=1000`, {
        headers: { "X-Admin-Token": ADMIN_TOKEN_FE }
      });
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      const js = await res.json();
      setSubmissions(js.items || []);
    } catch (e) {
      console.error(e);
      setErr("Ma’lumot olishda xatolik (token yoki API URL-ni tekshiring).");
    } finally {
      setLoading(false);
    }
  }

  function exportCSV() {
    window.open(`${API_BASE}/api/v1/responses.csv?token=${encodeURIComponent(ADMIN_TOKEN_FE)}`, "_blank");
  }

  function clearAll() {
    alert("O‘chirish (serverda) funksiyasi qo‘shilmagan. CSV olib, serverdan qo‘lda tozalash tavsiya.");
  }

  useEffect(() => {
    // bitta linkdan /admin ochilsa – admin modal chiqsin
    if (window.location.pathname === "/admin") {
      setShowAdmin(true);
    }
  }, []);

  const gradientBg = {
    background: `radial-gradient(1200px 800px at -10% -20%, ${palette.teal}20 0%, transparent 60%), 
                 radial-gradient(1000px 700px at 110% 120%, ${palette.accent}22 0%, transparent 60%)`,
  };

  return (
    <div className="min-h-screen" style={{ background: palette.bg }}>
      <div className="sticky top-0 z-30 backdrop-blur border-b border-white/40" style={{ background: "rgba(255,248,242,0.6)" }}>
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center justify-center w-9 h-9 rounded-xl"
                  style={{ background: palette.card, boxShadow: "0 8px 20px rgba(139,69,19,0.12)" }}>
              <ClipboardList className="w-5 h-5" style={{ color: palette.choco }} />
            </span>
            <div>
              <div className="font-bold text-lg" style={{ color: palette.choco }}>Cinnabon So‘rov</div>
              <div className="text-xs" style={{ color: palette.accentDark }}>Ta’mni birga charxlaymiz ✨</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button className="text-sm px-3 py-1.5 rounded-lg border hover:opacity-90 transition"
              style={{ borderColor: palette.teal, color: palette.teal }} onClick={() => setShowAdmin(true)}>
              <Lock className="w-4 h-4 inline mr-1" /> Admin
            </button>
          </div>
        </div>
      </div>

      <div className="relative">
        <div className="max-w-4xl mx-auto px-4 pt-10 pb-2">
          <div className="mb-4">
            <h1 className="text-2xl md:text-3xl font-extrabold" style={{ color: palette.choco }}>
              Birinchi ta’surotingiz biz uchun juda muhim! 🌀
            </h1>
            <p className="text-sm md:text-base mt-1" style={{ color: "#7a5c3a" }}>
              Savollar ketma-ket chiqadi. Umumiy {totalQuestions} ta savol bor. 
            </p>
          </div>
          <div className="w-full h-3 rounded-full overflow-hidden" style={{ background: "#F7E6D8" }}>
            <div className="h-full transition-all"
              style={{ width: `${(Math.min(step, totalQuestions) / totalQuestions) * 100}%`, background: `linear-gradient(90deg, ${palette.accent}, ${palette.teal})` }} />
          </div>
          <div className="mt-1 text-xs" style={{ color: palette.accentDark }}>
            Javob berildi: {answeredCount} / {totalQuestions}
          </div>
        </div>
      </div>

      <div className="relative" style={gradientBg}>
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div ref={cardRef} onMouseMove={onMouseMoveCard} onMouseLeave={onMouseLeaveCard}
            className="rounded-3xl p-5 md:p-7"
            style={{ background: palette.card, boxShadow: "0 30px 80px rgba(139,69,19,0.18)", transform: `perspective(1000px) rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg)`, transition: "transform 120ms ease-out" }}>
            <AnimatePresence mode="wait">
              {!atReview && step < totalQuestions && (
                <motion.div key={currentQ?.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.25 }}>
                  <Question q={currentQ} value={answers[currentQ?.id]} onChange={(v) => updateAnswer(currentQ?.id, v)} />
                  <div className="mt-6 flex items-center justify-between">
                    <button onClick={goPrev} disabled={step === 0} className="px-4 py-2 rounded-xl border flex items-center gap-2 disabled:opacity-40"
                      style={{ borderColor: palette.choco, color: palette.choco }}>
                      <ChevronLeft className="w-4 h-4" /> Orqaga
                    </button>
                    <button onClick={goNext} disabled={!canNext || loading} className="px-5 py-2 rounded-xl font-semibold flex items-center gap-2 disabled:opacity-50"
                      style={{ background: (!canNext || loading) ? "#E5D3C5" : `linear-gradient(90deg, ${palette.accent}, ${palette.teal})`, color: "white", boxShadow: !canNext ? "none" : "0 8px 24px rgba(231,111,81,0.35)" }}>
                      Keyingi savol <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="mt-4 text-xs" style={{ color: "#8b6b4f" }}>Savol {step + 1} / {totalQuestions}</div>
                  {err && <div className="mt-3 text-sm" style={{ color: "#B00020" }}>{err}</div>}
                </motion.div>
              )}

              {atReview && (
                <motion.div key="review" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.25 }}>
                  <h2 className="text-xl font-bold mb-2" style={{ color: palette.choco }}>Ko‘rib chiqing 📋</h2>
                  <p className="text-sm mb-4" style={{ color: "#7a5c3a" }}>Javoblaringizni yuborishdan avval tekshirishingiz mumkin.</p>
                  <div className="grid gap-3">
                    {questions.map((q) => (
                      <div key={q.id} className="rounded-2xl p-3 border" style={{ borderColor: "#E6CDBA", background: "#FFF9F4" }}>
                        <div className="text-sm font-semibold" style={{ color: palette.choco }}>{q.title} {q.subtitle ? <span className="opacity-70">{q.subtitle}</span> : null}</div>
                        <div className="mt-1 text-sm" style={{ color: "#6b4f35" }}>
                          {Array.isArray(answers[q.id]) ? (answers[q.id]).join(", ") : String(answers[q.id])}
                        </div>
                        <div className="mt-2">
                          <button onClick={() => setStep(questions.findIndex(qq => qq.id === q.id))} className="text-xs px-2 py-1 rounded-lg border hover:opacity-80"
                            style={{ borderColor: palette.teal, color: palette.teal }}>Tahrirlash</button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-6 flex items-center justify-between">
                    <button onClick={goPrev} className="px-4 py-2 rounded-xl border flex items-center gap-2"
                      style={{ borderColor: palette.choco, color: palette.choco }}><ChevronLeft className="w-4 h-4" /> Orqaga</button>
                    <button onClick={submitAll} disabled={loading} className="px-5 py-2 rounded-xl font-semibold flex items-center gap-2"
                      style={{ background: `linear-gradient(90deg, ${palette.accent}, ${palette.teal})`, opacity: loading ? 0.7 : 1, color: "white", boxShadow: "0 8px 24px rgba(42,157,143,0.35)" }}>
                      {loading ? "Yuborilyapti..." : <>Yuborish <CheckCircle2 className="w-5 h-5" /></>}
                    </button>
                  </div>
                  {err && <div className="mt-3 text-sm" style={{ color: "#B00020" }}>{err}</div>}
                </motion.div>
              )}

              {step > totalQuestions && (
                <motion.div key="thanks" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.25 }} className="text-center">
                  <h2 className="text-2xl font-extrabold" style={{ color: palette.choco }}>Rahmat! 🧡</h2>
                  <p className="mt-2 text-sm" style={{ color: "#7a5c3a" }}>Javobingiz saqlandi.</p>
                  <div className="mt-5 flex items-center justify-center gap-3">
                    <button onClick={() => { setAnswers({}); setStep(0); }} className="px-5 py-2 rounded-xl font-semibold"
                      style={{ background: `linear-gradient(90deg, ${palette.accent}, ${palette.teal})`, color: "white" }}>
                      Yana to‘ldirish
                    </button>
                    <button onClick={() => setShowAdmin(true)} className="px-5 py-2 rounded-xl font-semibold border"
                      style={{ borderColor: palette.teal, color: palette.teal }}>
                      Admin panelga o‘tish
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      <div className="py-8 text-center text-xs" style={{ color: "#8b6b4f" }}>
        © {new Date().getFullYear()} Cinnabon So‘rov — Ulug‘bek uchun mini‑sait
      </div>

      <AnimatePresence>
        {showAdmin && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.35)" }}>
            <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 10, opacity: 0 }} transition={{ duration: 0.2 }}
              className="w-[95vw] max-w-4xl max-h-[86vh] overflow-hidden rounded-3xl"
              style={{ background: palette.card, boxShadow: "0 30px 80px rgba(0,0,0,0.25)" }}>
              <div className="p-5 border-b" style={{ borderColor: "#E6CDBA" }}>
                <div className="flex items-center justify-between">
                  <div className="font-bold" style={{ color: palette.choco }}>Admin panel</div>
                  <button onClick={() => { setShowAdmin(false); setPinInput(""); }} className="text-sm px-3 py-1.5 rounded-lg border"
                          style={{ borderColor: palette.teal, color: palette.teal }}>Yopish</button>
                </div>
              </div>

              {!adminUnlocked ? (
                <div className="p-6">
                  <div className="flex items-center gap-3 text-sm" style={{ color: "#7a5c3a" }}>
                    <Lock className="w-4 h-4" /> Admin PIN kiriting
                  </div>
                  <div className="mt-3 flex items-center gap-3">
                    <input type="password" inputMode="numeric" value={pinInput} onChange={(e) => setPinInput(e.target.value)}
                      className="px-4 py-2 rounded-xl border outline-none w-40" style={{ borderColor: "#E6CDBA", background: "#FFF9F4" }} placeholder="****" />
                    <button onClick={() => setAdminUnlocked(pinInput === ADMIN_PIN)} className="px-5 py-2 rounded-xl font-semibold"
                      style={{ background: `linear-gradient(90deg, ${palette.accent}, ${palette.teal})`, color: "white" }}>Kirish</button>
                    {pinInput && pinInput !== ADMIN_PIN && (<span className="text-xs" style={{ color: palette.accentDark }}>Noto‘g‘ri PIN</span>)}
                  </div>
                  <div className="mt-3 text-xs" style={{ color: "#8b6b4f" }}>
                    PIN — faqat UI uchun. Ma’lumotlar serverda <code>X-Admin-Token</code> bilan himoyalanadi.
                  </div>
                </div>
              ) : (
                <div className="p-6 overflow-auto" style={{ maxHeight: "70vh" }}>
                  <div className="flex flex-wrap items-center gap-2 mb-4">
                    <button onClick={exportCSV}
                      className="px-4 py-2 rounded-xl font-semibold flex items-center gap-2"
                      style={{ background: `linear-gradient(90deg, ${palette.accent}, ${palette.teal})`, color: "white" }}>
                      <Download className="w-4 h-4" /> CSV eksport
                    </button>
                    <button onClick={clearAll}
                      className="px-4 py-2 rounded-xl border flex items-center gap-2"
                      style={{ borderColor: palette.accent, color: palette.accentDark }}>
                      <Trash2 className="w-4 h-4" /> O‘chirish
                    </button>
                    <div className="text-xs ml-auto" style={{ color: "#7a5c3a" }}>
                      Jami javoblar: <b>{submissions.length}</b>
                    </div>
                  </div>

                  <div className="rounded-2xl border" style={{ borderColor: "#E6CDBA", background: "#FFF9F4" }}>
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left" style={{ color: palette.choco }}>
                          <th className="p-3 border-b" style={{ borderColor: "#E6CDBA" }}>Vaqt</th>
                          {questions.map(q => (<th key={q.id} className="p-3 border-b" style={{ borderColor: "#E6CDBA" }}>{q.id}</th>))}
                        </tr>
                      </thead>
                      <tbody>
                        {submissions.length === 0 ? (
                          <tr><td className="p-4 text-center text-xs" colSpan={1 + questions.length} style={{ color: "#8b6b4f" }}>Hozircha javob yo‘q.</td></tr>
                        ) : (
                          submissions.map((s, i) => (
                            <tr key={i} className="hover:bg-white/60">
                              <td className="p-3 align-top" style={{ color: "#6b4f35" }}>{new Date(s.created_at).toLocaleString()}</td>
                              {questions.map(q => (
                                <td key={q.id} className="p-3 align-top" style={{ color: "#6b4f35" }}>
                                  {Array.isArray(s.answers?.[q.id]) ? s.answers[q.id].join(", ") : String(s.answers?.[q.id] ?? "")}
                                </td>
                              ))}
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="fixed bottom-6 right-6">
        <div className="rounded-2xl shadow-xl backdrop-blur px-4 py-3 border" style={{ background: "rgba(255,249,244,0.85)", borderColor: "#f0dccd" }}>
          <div className="text-xs" style={{ color: "#7a5c3a" }}>
            Holat: {atReview ? "Ko‘rib chiqish" : (step > totalQuestions ? "Yakunlandi" : `Savol ${step + 1} / ${totalQuestions}`)}
          </div>
        </div>
      </div>
    </div>
  );
}

function Question({ q, value, onChange }) {
  switch (q.type) {
    case "single": return <SingleChoice q={q} value={value} onChange={onChange} />;
    case "multi":  return <MultiChoice q={q} value={value} onChange={onChange} />;
    case "scale":  return <Scale q={q} value={value} onChange={onChange} />;
    case "number": return <NumberInput q={q} value={value} onChange={onChange} />;
    default: return null;
  }
}

function Title({ title, subtitle }) {
  return (
    <div className="mb-4">
      <h2 className="text-xl md:text-2xl font-bold" style={{ color: palette.choco }}>{title}</h2>
      {subtitle && <div className="text-sm mt-1" style={{ color: "#7a5c3a" }}>{subtitle}</div>}
    </div>
  );
}

function SingleChoice({ q, value, onChange }) {
  return (
    <div>
      <Title title={q.title} subtitle={q.subtitle} />
      <div className="grid sm:grid-cols-2 gap-2">
        {q.options.map((opt) => (
          <button key={opt} onClick={() => onChange(opt)}
            className={`px-4 py-3 rounded-2xl border text-left transition ${value === opt ? "ring-2" : ""}`}
            style={{ borderColor: value === opt ? palette.teal : "#E6CDBA", background: value === opt ? "#E9FFFA" : "#FFFCF8", color: "#6b4f35" }}>
            {opt}
          </button>
        ))}
      </div>
      {q.options.includes("Boshqa (yozing)") && value === "Boshqa (yozing)" && (
        <input autoFocus className="mt-3 w-full px-4 py-3 rounded-2xl border outline-none"
          style={{ borderColor: "#E6CDBA", background: "#FFF9F4", color: "#6b4f35" }}
          placeholder="Aniqlashtiring..." onChange={(e) => onChange(e.target.value)} />
      )}
    </div>
  );
}

function MultiChoice({ q, value = [], onChange }) {
  const selected = Array.isArray(value) ? value : [];
  function toggle(opt) { if (selected.includes(opt)) onChange(selected.filter((x) => x !== opt)); else onChange([...selected, opt]); }
  const hasOther = q.options.includes("Boshqa (yozing)");
  return (
    <div>
      <Title title={q.title} subtitle={q.subtitle} />
      <div className="grid sm:grid-cols-2 gap-2">
        {q.options.map((opt) => (
          <button key={opt} onClick={() => toggle(opt)}
            className={`px-4 py-3 rounded-2xl border text-left transition ${selected.includes(opt) ? "ring-2" : ""}`}
            style={{ borderColor: selected.includes(opt) ? palette.teal : "#E6CDBA", background: selected.includes(opt) ? "#E9FFFA" : "#FFFCF8", color: "#6b4f35" }}>
            {opt}
          </button>
        ))}
      </div>
      {hasOther && selected.includes("Boshqa (yozing)") && (
        <input autoFocus className="mt-3 w-full px-4 py-3 rounded-2xl border outline-none"
          style={{ borderColor: "#E6CDBA", background: "#FFF9F4", color: "#6b4f35" }}
          placeholder="Boshqa: nimalarni xohlaysiz?"
          onChange={(e) => {
            const text = e.target.value;
            const base = selected.filter((s) => q.options.includes(s));
            const merged = text ? [...base, text] : base;
            onChange(merged);
          }} />
      )}
    </div>
  );
}

function Scale({ q, value, onChange }) {
  const min = q.min ?? 0;
  const max = q.max ?? 10;
  const items = Array.from({ length: max - min + 1 }, (_, i) => i + min);
  return (
    <div>
      <Title title={q.title} subtitle={q.subtitle} />
      <div className="flex flex-wrap gap-2">
        {items.map((n) => (
          <button key={n} onClick={() => onChange(n)}
            className={`w-12 h-12 rounded-2xl border font-bold ${value === n ? "ring-2" : ""}`}
            style={{ borderColor: value === n ? palette.teal : "#E6CDBA", background: value === n ? "#E9FFFA" : "#FFFCF8", color: "#6b4f35" }}>
            {n}
          </button>
        ))}
      </div>
    </div>
  );
}

function NumberInput({ q, value, onChange }) {
  const [local, setLocal] = useState(value ?? "");
  useEffect(() => { setLocal(value ?? ""); }, [value]);
  return (
    <div>
      <Title title={q.title} subtitle={q.subtitle} />
      <div className="flex items-center gap-2">
        <input inputMode="numeric" value={local}
          onChange={(e) => setLocal(e.target.value.replace(/[^0-9]/g, ""))}
          onBlur={() => onChange(local ? Number(local) : "")}
          className="px-4 py-3 rounded-2xl border outline-none w-60"
          style={{ borderColor: "#E6CDBA", background: "#FFF9F4", color: "#6b4f35" }} placeholder="so‘m" />
        <span className="text-sm" style={{ color: "#7a5c3a" }}>so‘m</span>
      </div>
    </div>
  );
}
