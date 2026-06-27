import { useEffect, useMemo, useState } from "react";
import { useForm, type UseFormRegister } from "react-hook-form";
import "./App.css";
import { links } from "./lib/links";
import { submitRegistration } from "./lib/registration";

const LOGO = "https://nuscomputing.com/comclub_logo.png";
const EVENT_START = new Date("2026-08-22T09:00:00+08:00").getTime();

/* ------------------------------------------------------------------ */
/* Shared styling tokens                                               */
/* ------------------------------------------------------------------ */
const GOLD = "#c9964a";

const eyebrow =
  "ff-mono text-[12px] tracking-[0.18em] uppercase text-[#c9964a]";
const sectionTitle =
  "ff-serif font-semibold leading-[1.05] tracking-[-0.02em] text-white";
const solidBtn =
  "inline-flex items-center justify-center gap-2 rounded-lg bg-[#9a6a2f] px-6 py-[14px] text-[15px] font-semibold text-white transition hover:bg-[#c9964a]";
const ghostBtn =
  "inline-flex items-center justify-center gap-2 rounded-lg border border-white/25 px-6 py-[14px] text-[15px] font-semibold text-white transition hover:border-white";

/* ------------------------------------------------------------------ */
/* Countdown                                                           */
/* ------------------------------------------------------------------ */
function genTeamCode() {
  const c = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 6; i++) s += c[Math.floor(Math.random() * c.length)];
  return "LH26-" + s;
}

function getCountdown() {
  let diff = Math.max(0, EVENT_START - Date.now());
  const days = Math.floor(diff / 86400000);
  diff -= days * 86400000;
  const hours = Math.floor(diff / 3600000);
  diff -= hours * 3600000;
  const minutes = Math.floor(diff / 60000);
  diff -= minutes * 60000;
  const seconds = Math.floor(diff / 1000);
  const p = (n: number) => String(n).padStart(2, "0");
  return { days: p(days), hours: p(hours), minutes: p(minutes), seconds: p(seconds) };
}

/* ------------------------------------------------------------------ */
/* Static content                                                      */
/* ------------------------------------------------------------------ */
const facts = [
  ["Dates", "22–23 Aug"],
  ["Duration", "24 hours"],
  ["Tracks", "Two"],
  ["Participants", "300–400"],
];

type Question = {
  q: string;
  diff: string;
  options: string[];
  correct: number;
  advanced: boolean;
};

const QUESTIONS: Question[] = [
  {
    q: "What is the time complexity of binary search on a sorted array of n elements?",
    diff: "Warm-up",
    options: ["O(n)", "O(log n)", "O(n log n)", "O(1)"],
    correct: 1,
    advanced: false,
  },
  {
    q: "Which structure gives O(1) average insertion, deletion and lookup by key?",
    diff: "Easy",
    options: ["Dynamic array", "Hash map", "Sorted list", "Stack"],
    correct: 1,
    advanced: false,
  },
  {
    q: "You must repeatedly remove the smallest element from a set that keeps changing. Best choice?",
    diff: "Medium",
    options: [
      "Queue (FIFO)",
      "Min-heap / priority queue",
      "Hash set",
      "Singly linked list",
    ],
    correct: 1,
    advanced: false,
  },
  {
    q: "Naive recursive Fibonacci is O(2ⁿ). Which technique brings it down to O(n)?",
    diff: "Advanced · optional",
    options: [
      "Deeper recursion",
      "Memoisation / dynamic programming",
      "Bubble sort",
      "A global counter",
    ],
    correct: 1,
    advanced: true,
  },
  {
    q: "Single-source shortest paths in a weighted graph with non-negative edges. Standard algorithm?",
    diff: "Advanced · optional",
    options: [
      "Breadth-first search",
      "Dijkstra's algorithm",
      "Depth-first search",
      "Insertion sort",
    ],
    correct: 1,
    advanced: true,
  },
];

const FAQS = [
  {
    q: "Who can take part?",
    a: "LifeHack 2026 is open to all university students across Singapore. Both product builders and competitive programmers are welcome.",
  },
  {
    q: "Can I compete in both tracks?",
    a: "Yes. The Main Hackathon and the Algorithmic Hackathon run at separate times, so you can register for and compete in both over the weekend.",
  },
  {
    q: "What exactly is the Algorithmic Hackathon?",
    a: "A focused, ~2 hour 45 minute competitive-programming sprint on Codeforces. You solve a series of algorithmic problems on your own laptop; standings are ranked by problems solved and time taken.",
  },
  {
    q: "Do I need a team?",
    a: "Only for the Main Hackathon, which is team-based — create a team, join one with a code, or sign up solo and be grouped before the event. The Algorithmic Hackathon is strictly individual.",
  },
  {
    q: "Why is there a warm-up for the Algorithmic track?",
    a: "The Algorithmic Hackathon has limited seats. A short, optional warm-up helps us understand the level of everyone signing up so we can plan a fair, well-matched contest.",
  },
  {
    q: "When are problem statements released?",
    a: "Problem statements are revealed on stage during the event and published on this site within minutes of the announcement.",
  },
  {
    q: "How does check-in work on the day?",
    a: "Your online registration is linked to your physical check-in via a QR code, so arriving on event day is quick and contactless.",
  },
];

const SIGNUPS_1 = [
  "Marcus T.", "Priya R.", "Wei Jie L.", "Sarah K.",
  "Daniel O.", "Jia Hui T.", "Arjun M.", "Rachel N.",
];
const SIGNUPS_2 = [
  "Bryan S.", "Nikhil P.", "Mei Ling C.", "Hafiz R.",
  "Joel T.", "Aisyah B.", "Ryan W.", "Charmaine L.",
];

/* ------------------------------------------------------------------ */
/* Small presentational helpers                                        */
/* ------------------------------------------------------------------ */
function CountdownBoxes({
  cd,
}: {
  cd: ReturnType<typeof getCountdown>;
}) {
  const cells: [string, string, boolean][] = [
    [cd.days, "Days", false],
    [cd.hours, "Hrs", false],
    [cd.minutes, "Min", false],
    [cd.seconds, "Sec", true],
  ];
  return (
    <div className="inline-flex flex-wrap justify-center gap-3.5">
      {cells.map(([value, label, accent]) => (
        <div
          key={label}
          className={`min-w-[88px] rounded-xl border px-[22px] py-4 ${
            accent
              ? "border-[#9a6a2f]/60 bg-[#9a6a2f]/15"
              : "border-white/14 bg-white/[0.04]"
          }`}
          style={!accent ? { borderColor: "rgba(255,255,255,0.14)" } : undefined}
        >
          <div
            className="ff-mono text-[40px] font-medium leading-none"
            style={{ color: accent ? GOLD : "#fff" }}
          >
            {value}
          </div>
          <div className="ff-mono mt-[7px] text-[10px] uppercase tracking-[0.14em] text-slate-400">
            {label}
          </div>
        </div>
      ))}
    </div>
  );
}

function Input({
  label,
  placeholder,
  mono,
  full,
  name,
  type,
  required,
  register,
}: {
  label: string;
  placeholder: string;
  mono?: boolean;
  full?: boolean;
  name?: string;
  type?: string;
  required?: boolean;
  register?: UseFormRegister<Record<string, unknown>>;
}) {
  const fieldProps =
    register && name ? register(name, { required }) : {};
  return (
    <div className={full ? "sm:col-span-2" : undefined}>
      <label className="mb-[7px] block ff-mono text-[10.5px] uppercase tracking-[0.1em] text-slate-400">
        {label}
      </label>
      <input
        {...fieldProps}
        type={type}
        placeholder={placeholder}
        className={`w-full rounded-lg border border-white/12 bg-white/[0.04] px-[14px] py-3 text-[15px] text-white outline-none transition placeholder:text-slate-500 focus:border-[#c9964a] focus:ring-2 focus:ring-[#c9964a]/25 ${
          mono ? "ff-mono tracking-[0.04em]" : ""
        }`}
      />
    </div>
  );
}

function FormFooter({
  sending,
  error,
  label,
}: {
  sending: boolean;
  error: boolean;
  label: string;
}) {
  return (
    <>
      {error && (
        <p className="mt-3 text-[13px] text-red-400">
          Something went wrong — please check your details and try again.
        </p>
      )}
      <button
        type="submit"
        disabled={sending}
        className="mt-[18px] w-full rounded-[10px] bg-[#9a6a2f] py-[15px] text-[15px] font-semibold text-white transition hover:bg-[#c9964a] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {sending ? "Submitting…" : label}
      </button>
    </>
  );
}

/* ================================================================== */
/* App                                                                 */
/* ================================================================== */
function App() {
  const [cd, setCd] = useState(getCountdown());

  // Warm-up quiz
  const [scStarted, setScStarted] = useState(false);
  const [scIndex, setScIndex] = useState(0);
  const [scAnswers, setScAnswers] = useState<
    { answer: number | null; skipped: boolean }[]
  >([]);
  const [scDone, setScDone] = useState(false);

  // Registration
  const [regTab, setRegTab] = useState<"main" | "algo">("main");
  const [mainMode, setMainMode] = useState<"" | "create" | "join" | "solo">("");
  const [teamCode, setTeamCode] = useState("");

  // FAQ
  const [faqOpen, setFaqOpen] = useState(0);

  // Registration submission
  const [reg, setReg] = useState<{
    status: "idle" | "sending" | "done" | "error";
  }>({ status: "idle" });
  const algoForm = useForm<Record<string, unknown>>();
  const createForm = useForm<Record<string, unknown>>();
  const joinForm = useForm<Record<string, unknown>>();
  const soloForm = useForm<Record<string, unknown>>();

  const submit = async (
    track: "Main" | "Algo",
    data: Record<string, unknown>
  ) => {
    setReg({ status: "sending" });
    try {
      await submitRegistration({
        track,
        ...data,
      } as Parameters<typeof submitRegistration>[0]);
      setReg({ status: "done" });
    } catch {
      setReg({ status: "error" });
    }
  };
  const resetReg = () => {
    setReg({ status: "idle" });
    algoForm.reset();
    createForm.reset();
    joinForm.reset();
    soloForm.reset();
    setMainMode("");
    setTeamCode("");
  };

  useEffect(() => {
    const t = window.setInterval(() => setCd(getCountdown()), 1000);
    return () => window.clearInterval(t);
  }, []);

  /* ---- quiz helpers ---- */
  const advance = (answers: typeof scAnswers) => {
    const next = scIndex + 1;
    if (next >= QUESTIONS.length) {
      setScAnswers(answers);
      setScDone(true);
    } else {
      setScAnswers(answers);
      setScIndex(next);
    }
  };
  const answerSC = (idx: number) => {
    const a = scAnswers.slice();
    a[scIndex] = { answer: idx, skipped: false };
    advance(a);
  };
  const skipSC = () => {
    const a = scAnswers.slice();
    a[scIndex] = { answer: null, skipped: true };
    advance(a);
  };
  const startSC = () => {
    setScStarted(true);
    setScIndex(0);
    setScAnswers([]);
    setScDone(false);
  };
  const restartSC = () => {
    setScStarted(false);
    setScIndex(0);
    setScAnswers([]);
    setScDone(false);
  };

  const result = useMemo(() => {
    let attempted = 0;
    let correct = 0;
    let advAtt = 0;
    let advTot = 0;
    QUESTIONS.forEach((qq, i) => {
      if (qq.advanced) advTot++;
      const ans = scAnswers[i];
      if (ans && !ans.skipped) {
        attempted++;
        if (ans.answer === qq.correct) correct++;
        if (qq.advanced) advAtt++;
      }
    });
    let level: string;
    let desc: string;
    if (correct >= 4) {
      level = "Advanced";
      desc =
        "Strong grasp of core algorithms — you should feel right at home in the contest.";
    } else if (correct >= 2) {
      level = "Intermediate";
      desc =
        "Solid fundamentals. A little practice on heaps, graphs and DP before the day will pay off.";
    } else {
      level = "Foundational";
      desc =
        "A good starting point — drilling data-structure and algorithm basics beforehand will help a lot.";
    }
    let willing: string;
    if (advAtt === advTot)
      willing =
        "You attempted every advanced question — exactly the competitive instinct this track rewards.";
    else if (advAtt > 0)
      willing =
        "You took on one of the advanced questions — nice. Attempting them is part of what we look at.";
    else
      willing =
        "You skipped the advanced questions — that's completely fine. Whether you attempt them is part of how we gauge readiness.";
    return { attempted, correct, level, desc, willing };
  }, [scAnswers]);

  /* ---- registration helpers ---- */
  const setMode = (m: "create" | "join" | "solo") => {
    setReg({ status: "idle" });
    setMainMode(m);
    setTeamCode(m === "create" ? genTeamCode() : "");
  };

  const cur = QUESTIONS[scIndex] ?? QUESTIONS[0];
  const progressPct = Math.round((scIndex / QUESTIONS.length) * 100);

  const pathCard = (active: boolean) =>
    `cursor-pointer rounded-xl border p-[18px] text-left transition ${
      active
        ? "border-[#c9964a] bg-[#c9964a]/10"
        : "border-white/12 bg-white/[0.02] hover:border-white/25"
    }`;

  return (
    <div className="min-h-screen bg-[#05070a] text-white">
      {/* ---------------- NAV ---------------- */}
      <nav className="sticky top-0 z-[60] border-b border-white/10 bg-[#05070a]/82 backdrop-blur-xl">
        <div className="mx-auto flex h-[66px] max-w-[1180px] items-center justify-between px-7">
          <a href="#top" className="flex items-center gap-3">
            <span className="inline-flex items-center justify-center rounded-md bg-white px-2 py-1">
              <img src={LOGO} alt="NUS Computing Club" className="block h-[26px] w-auto" />
            </span>
            <span className="ff-serif text-[19px] font-semibold tracking-[-0.01em] text-white">
              LifeHack<span style={{ color: GOLD }}>&nbsp;2026</span>
            </span>
          </a>
          <div className="hidden items-center gap-[30px] md:flex">
            {[
              ["About", "#about"],
              ["Tracks", "#tracks"],
              ["Algorithmic", "#algorithmic"],
              ["Sponsors", "#sponsors"],
              ["Club", "#organiser"],
              ["FAQ", "#faq"],
            ].map(([label, href]) => (
              <a
                key={href}
                href={href}
                className="text-[14.5px] font-medium text-slate-300 transition hover:text-white"
              >
                {label}
              </a>
            ))}
          </div>
          <a
            href="#register"
            className="inline-flex items-center rounded-lg bg-[#9a6a2f] px-5 py-2.5 text-[14px] font-semibold text-white transition hover:bg-[#c9964a]"
          >
            Register
          </a>
        </div>
      </nav>

      <div id="top" />

      {/* ---------------- HERO ---------------- */}
      <section className="grid-bg animate-fade">
        <div className="mx-auto max-w-[1180px] px-7 py-[84px] text-center">
          <div className={`${eyebrow} mb-[26px] tracking-[0.2em]`}>
            NUS Computing Club · Flagship Hackathon
          </div>
          <h1
            className="ff-serif font-semibold tracking-[-0.025em] text-white"
            style={{ fontSize: "clamp(52px,9vw,108px)", lineHeight: 0.96 }}
          >
            LifeHack 2026
          </h1>
          <p className="mx-auto mt-[26px] max-w-[36em] text-[20px] leading-[1.55] text-slate-300">
            Two tracks. One weekend. A sponsor-backed 24-hour build challenge and
            a competitive-programming sprint — built around real engineering
            problems.
          </p>
          <p className="ff-mono mt-4 mb-10 text-[13px] tracking-[0.06em] text-[#c9964a]">
            22–23 August 2026 &nbsp;·&nbsp; COM3 MPH, NUS School of Computing
          </p>

          <div className="mb-[42px]">
            <CountdownBoxes cd={cd} />
          </div>

          <div className="flex flex-wrap justify-center gap-3.5">
            <a href="#register" className={solidBtn}>
              Register now
            </a>
            <a href="#tracks" className={ghostBtn}>
              Explore the tracks
            </a>
          </div>
        </div>
      </section>

      {/* ---------------- FACTS STRIP ---------------- */}
      <section className="border-y border-white/10 bg-[#0a0d14]">
        <div className="mx-auto grid max-w-[1180px] grid-cols-2 px-7 md:grid-cols-4">
          {facts.map(([label, value], i) => (
            <div
              key={label}
              className={`border-white/10 px-[22px] py-[26px] ${
                i % 2 === 0 ? "border-r" : ""
              } ${i < facts.length - 1 ? "md:border-r" : ""}`}
            >
              <div className="ff-mono mb-2 text-[10.5px] uppercase tracking-[0.14em] text-slate-500">
                {label}
              </div>
              <div className="ff-serif text-[21px] font-semibold text-white">
                {value}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ---------------- ABOUT ---------------- */}
      <section
        id="about"
        className="mx-auto grid max-w-[1180px] gap-14 px-7 py-[84px] md:grid-cols-[0.8fr_1.2fr]"
      >
        <div>
          <div className={`${eyebrow} mb-[18px]`}>What is LifeHack</div>
          <h2 className={sectionTitle} style={{ fontSize: "clamp(30px,4vw,46px)" }}>
            The Computing Club's flagship hackathon.
          </h2>
        </div>
        <div className="flex flex-col gap-6 pt-2">
          <p className="text-[18px] leading-[1.6] text-slate-300">
            LifeHack pairs a professional, industry-focused competition with
            genuine engineering challenge. Problem statements are developed
            together with our industry partners, giving participants the chance
            to work on authentic, real-world problems — not toy exercises.
          </p>
          <p className="text-[18px] leading-[1.6] text-slate-300">
            It runs as two distinct tracks: a main hackathon and an algorithmic
            hackathon. The two are scheduled at separate times, so you're welcome
            to take part in both over the weekend.
          </p>
          <div className="mt-1.5 flex gap-[34px]">
            {[
              ["2", "distinct tracks"],
              ["24h", "main build window"],
              ["Real", "industry problems"],
            ].map(([v, l], i) => (
              <div key={l} className="flex items-center gap-[34px]">
                {i > 0 && <span className="h-10 w-px bg-white/10" />}
                <div>
                  <div className="ff-serif text-[34px] font-semibold text-white">
                    {v}
                  </div>
                  <div className="mt-0.5 text-[13.5px] text-slate-500">{l}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------- TRACKS ---------------- */}
      <section id="tracks" className="border-t border-white/10 bg-white/[0.02]">
        <div className="mx-auto max-w-[1180px] px-7 py-[84px]">
          <div className={`${eyebrow} mb-4`}>Two tracks</div>
          <h2
            className={`${sectionTitle} mb-12 max-w-[16em]`}
            style={{ fontSize: "clamp(30px,4vw,46px)" }}
          >
            Build something real, or race the clock. Or do both.
          </h2>
          <div className="grid gap-[26px] md:grid-cols-2">
            {/* Track 1 */}
            <article className="flex flex-col rounded-2xl border border-white/12 bg-white/[0.03] p-9">
              <div className="mb-5 flex items-center gap-3">
                <span className="ff-mono rounded-md bg-[#0a1e3b] px-[11px] py-[5px] text-[11px] tracking-[0.12em] text-white">
                  TRACK 01
                </span>
                <span className="ff-mono text-[11px] tracking-[0.1em] text-slate-500">
                  TEAM-BASED
                </span>
              </div>
              <h3 className="ff-serif mb-3.5 text-[30px] font-semibold tracking-[-0.01em] text-white">
                Main Hackathon
              </h3>
              <p className="mb-6 text-[16px] leading-[1.6] text-slate-300">
                Teams spend 24 hours building against real-world problem
                statements set by our industry sponsors. Judging is done by
                representatives from the sponsoring companies, with a rubric
                focused on practicality and real-world applicability.
              </p>
              <div className="mt-auto flex flex-col">
                {[
                  ["Format", "24-hour build"],
                  ["Problems", "Set by sponsors"],
                  ["Team size", "To be announced"],
                  ["Judged by", "Sponsor representatives"],
                ].map(([k, v]) => (
                  <div
                    key={k}
                    className="flex justify-between border-t border-white/8 py-3"
                  >
                    <span className="text-[14px] text-slate-500">{k}</span>
                    <span className="text-[14px] font-semibold text-slate-200">
                      {v}
                    </span>
                  </div>
                ))}
              </div>
              <a
                href="#register"
                className="mt-[26px] inline-flex items-center gap-2 text-[15px] font-semibold"
                style={{ color: GOLD }}
              >
                Register a team →
              </a>
            </article>

            {/* Track 2 */}
            <article className="flex flex-col rounded-2xl border border-[#c9964a]/35 bg-[#9a6a2f]/[0.06] p-9">
              <div className="mb-5 flex items-center gap-3">
                <span className="ff-mono rounded-md bg-[#9a6a2f] px-[11px] py-[5px] text-[11px] tracking-[0.12em] text-white">
                  TRACK 02
                </span>
                <span className="ff-mono text-[11px] tracking-[0.1em] text-slate-500">
                  INDIVIDUAL
                </span>
              </div>
              <h3 className="ff-serif mb-3.5 text-[30px] font-semibold tracking-[-0.01em] text-white">
                Algorithmic Hackathon
              </h3>
              <p className="mb-6 text-[16px] leading-[1.6] text-slate-300">
                A fast-paced coding sprint where you race the clock to crack a
                series of algorithmic puzzles — the LeetCode- and ICPC-style
                problems that test how well you really know data structures and
                algorithms.
              </p>
              <div className="mt-auto flex flex-col">
                {[
                  ["Format", "~2h 45m sprint"],
                  ["Platform", "Codeforces"],
                  ["Ranked by", "Problems solved & time"],
                  ["Seats", "~100 · warm-up"],
                ].map(([k, v]) => (
                  <div
                    key={k}
                    className="flex justify-between border-t border-white/8 py-3"
                  >
                    <span className="text-[14px] text-slate-500">{k}</span>
                    <span className="text-[14px] font-semibold text-slate-200">
                      {v}
                    </span>
                  </div>
                ))}
              </div>
              <a
                href="#algorithmic"
                className="mt-[26px] inline-flex items-center gap-2 text-[15px] font-semibold"
                style={{ color: GOLD }}
              >
                New to this? Learn more →
              </a>
            </article>
          </div>
        </div>
      </section>

      {/* ---------------- ALGORITHMIC DEEP DIVE + WARM-UP ---------------- */}
      <section id="algorithmic" className="grid-bg">
        <div className="mx-auto max-w-[1180px] px-7 py-[84px]">
          <div className="grid items-start gap-14 md:grid-cols-2">
            {/* Explainer */}
            <div>
              <div className={`${eyebrow} mb-[18px]`}>New here? Start with this</div>
              <h2
                className={`${sectionTitle} mb-[22px]`}
                style={{ fontSize: "clamp(30px,4vw,46px)" }}
              >
                What is competitive programming?
              </h2>
              <p className="mb-[18px] text-[17px] leading-[1.62] text-slate-300">
                Unlike the main hackathon — where you build a product over 24
                hours — the Algorithmic Hackathon is a timed problem-solving
                contest. You're given a set of self-contained puzzles, each with
                a precise input and expected output, and you write code that
                solves them correctly and quickly.
              </p>
              <p className="mb-[30px] text-[17px] leading-[1.62] text-slate-300">
                There's no UI, no slides, no pitch — just you, your editor, and
                the clock. It's the format used by ICPC and Codeforces, and it
                rewards a sharp command of data structures and algorithms.
              </p>
              <div className="flex flex-col gap-3.5">
                {[
                  "Solve as many problems as you can in ~2h 45m, on your own laptop.",
                  "You're ranked by problems solved first, then by time taken.",
                  "Integrity is enforced: on-site proctors, random screen checks, screen recording and post-contest plagiarism checks.",
                ].map((t, i) => (
                  <div key={i} className="flex items-start gap-3.5">
                    <span
                      className="ff-mono mt-0.5 text-[13px]"
                      style={{ color: GOLD }}
                    >
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span className="text-[15.5px] leading-[1.5] text-slate-200">
                      {t}
                    </span>
                  </div>
                ))}
              </div>

              <div className="mt-[34px] rounded-xl border border-white/12 bg-white/[0.04] px-6 py-[22px]">
                <div className="ff-mono mb-3 text-[10.5px] uppercase tracking-[0.14em] text-[#c9964a]">
                  A problem looks like this
                </div>
                <div className="ff-mono text-[13.5px] leading-[1.7] text-slate-300">
                  Given an array of N integers, find the
                  <br />
                  length of the longest strictly increasing
                  <br />
                  subsequence.
                  <br />
                  <span style={{ color: GOLD }}>Input:</span> 6 / 10 9 2 5 3 7
                  <br />
                  <span style={{ color: GOLD }}>Output:</span> 3{" "}
                  <span className="text-slate-500">// (2, 3, 7)</span>
                </div>
              </div>
            </div>

            {/* Warm-up card */}
            <div className="sticky top-[90px] overflow-hidden rounded-2xl border border-white/14 bg-[#0d1118]">
              <div className="flex items-center justify-between border-b border-white/10 px-[26px] py-[22px]">
                <div>
                  <div className="ff-mono text-[10.5px] uppercase tracking-[0.14em] text-[#c9964a]">
                    Pre-event warm-up · 2 min
                  </div>
                  <div className="ff-serif mt-[3px] text-[19px] font-semibold text-white">
                    Warm up for the sprint
                  </div>
                </div>
                <span className="ff-mono rounded-md bg-white/[0.06] px-2.5 py-1.5 text-[11px] text-slate-400">
                  5 Q
                </span>
              </div>

              {/* not started */}
              {!scStarted && (
                <div className="px-[26px] py-[30px]">
                  <p className="mb-2.5 text-[15.5px] leading-[1.6] text-slate-300">
                    Five quick questions to warm up your problem-solving before
                    the contest. It's <strong>not a filter</strong> — everyone
                    who wants a seat can take part. It simply helps us understand
                    the range of experience signing up so we can plan a fair
                    contest for the ~100 seats.
                  </p>
                  <p className="mb-[22px] text-[13px] leading-[1.55] text-slate-500">
                    We record which questions you attempt and how many you get
                    right — not your individual answers. Attempting the harder
                    ones is genuinely part of what we look at.
                  </p>
                  <button
                    onClick={startSC}
                    className="w-full rounded-[10px] bg-[#9a6a2f] py-[15px] text-[15px] font-semibold text-white transition hover:bg-[#c9964a]"
                  >
                    Start the warm-up →
                  </button>
                </div>
              )}

              {/* in progress */}
              {scStarted && !scDone && (
                <div className="p-[26px]">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="ff-mono text-[11px] tracking-[0.08em] text-slate-500">
                      QUESTION {scIndex + 1} / {QUESTIONS.length}
                    </span>
                    <span className="ff-mono text-[11px]" style={{ color: GOLD }}>
                      {cur.diff}
                    </span>
                  </div>
                  <div className="mb-[22px] h-1 overflow-hidden rounded-[3px] bg-white/10">
                    <div
                      className="h-full bg-[#c9964a] transition-all duration-300"
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>
                  <div className="mb-[22px] min-h-[54px] text-[18px] font-medium leading-[1.5] text-white">
                    {cur.q}
                  </div>
                  <div className="flex flex-col gap-2.5">
                    {cur.options.map((opt, i) => (
                      <button
                        key={i}
                        onClick={() => answerSC(i)}
                        className="flex items-center gap-3.5 rounded-[10px] border border-white/12 bg-white/[0.03] px-4 py-3.5 text-left text-[15px] text-white transition hover:border-[#c9964a] hover:bg-[#9a6a2f]/15"
                      >
                        <span className="ff-mono inline-flex h-6 w-6 flex-none items-center justify-center rounded-[5px] border border-white/15 text-[12px] text-slate-400">
                          {String.fromCharCode(65 + i)}
                        </span>
                        <span>{opt}</span>
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={skipSC}
                    className="mt-4 text-[13.5px] text-slate-500 underline underline-offset-[3px]"
                  >
                    Skip — not sure on this one
                  </button>
                </div>
              )}

              {/* done */}
              {scStarted && scDone && (
                <div className="px-[26px] py-[30px]">
                  <div className="ff-mono mb-2.5 text-[10.5px] uppercase tracking-[0.14em] text-slate-500">
                    Your estimated level
                  </div>
                  <div
                    className="ff-serif mb-3.5 text-[38px] font-semibold leading-none"
                    style={{ color: GOLD }}
                  >
                    {result.level}
                  </div>
                  <p className="mb-5 text-[15.5px] leading-[1.55] text-slate-300">
                    {result.desc}
                  </p>
                  <div className="mb-[18px] flex gap-3">
                    {[
                      [result.attempted, "attempted"],
                      [result.correct, "correct"],
                      [QUESTIONS.length, "total"],
                    ].map(([v, l]) => (
                      <div
                        key={l}
                        className="flex-1 rounded-[10px] border border-white/10 p-3.5 text-center"
                      >
                        <div className="ff-mono text-[28px] font-medium text-white">
                          {v}
                        </div>
                        <div className="mt-[3px] text-[11.5px] text-slate-500">
                          {l}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mb-5 rounded-[10px] border border-[#c9964a]/25 bg-[#9a6a2f]/10 px-4 py-3.5">
                    <p className="text-[13.5px] leading-[1.5] text-slate-300">
                      {result.willing}
                    </p>
                  </div>
                  <a
                    href="#register"
                    className="flex w-full items-center justify-center gap-2 rounded-[10px] bg-[#9a6a2f] py-[15px] text-[15px] font-semibold text-white transition hover:bg-[#c9964a]"
                  >
                    Continue to registration →
                  </a>
                  <button
                    onClick={restartSC}
                    className="mt-2.5 w-full text-[13.5px] text-slate-500 underline underline-offset-[3px]"
                  >
                    Take it again
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ---------------- ELIGIBILITY ---------------- */}
      <section className="border-t border-white/10">
        <div className="mx-auto flex max-w-[1180px] flex-wrap items-center gap-12 px-7 py-[72px]">
          <div className="min-w-[280px] flex-1">
            <div className={`${eyebrow} mb-4`}>Eligibility</div>
            <h2
              className={sectionTitle}
              style={{ fontSize: "clamp(28px,3.6vw,40px)" }}
            >
              Open to university students across Singapore.
            </h2>
          </div>
          <div className="flex min-w-[280px] flex-1 flex-col gap-4">
            {[
              [
                "Product builders",
                "Designers, developers and makers for the Main Hackathon.",
              ],
              [
                "Competitive programmers",
                "Algorithm enthusiasts for the Algorithmic Hackathon.",
              ],
            ].map(([t, d]) => (
              <div
                key={t}
                className="flex items-start gap-3.5 rounded-xl border border-white/12 px-5 py-[18px]"
              >
                <span className="mt-1.5 h-2.5 w-2.5 flex-none rounded-sm bg-[#c9964a]" />
                <div>
                  <div className="mb-[3px] text-[16px] font-semibold text-white">
                    {t}
                  </div>
                  <div className="text-[14.5px] text-slate-400">{d}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------- ORGANISED BY ---------------- */}
      <section id="organiser" className="mx-auto max-w-[1180px] px-7 py-20">
        <div className="grid-bg grid items-center gap-12 rounded-3xl border border-white/10 p-[clamp(34px,4vw,54px)] md:grid-cols-[1.1fr_0.9fr]">
          <div>
            <div className="mb-[26px] flex flex-wrap items-center gap-4">
              <span className="inline-flex items-center justify-center rounded-xl bg-white px-4 py-[11px]">
                <img src={LOGO} alt="NUS Computing Club" className="block h-[46px] w-auto" />
              </span>
              <span className="ff-mono text-[11px] uppercase tracking-[0.16em] text-[#c9964a]">
                Organised by
              </span>
            </div>
            <h2
              className={`${sectionTitle} mb-5`}
              style={{ fontSize: "clamp(28px,3.6vw,42px)" }}
            >
              NUS Students'
              <br />
              Computing Club
            </h2>
            <p className="mb-4 text-[16.5px] leading-[1.62] text-slate-300">
              The official faculty club and sole union representative of all
              undergraduates in the NUS School of Computing. Since 1998 it has
              championed student welfare, leadership and the bridge between
              students and the IT industry.
            </p>
            <p className="mb-7 text-[16.5px] leading-[1.62] text-slate-300">
              LifeHack is the club's flagship hackathon, organised each year by
              the Academic Liaison committee.
            </p>
            <a
              href="https://nuscomputing.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg bg-white px-6 py-[13px] text-[15px] font-semibold text-[#0a1e3b] transition hover:bg-[#e7ecf5]"
            >
              Visit nuscomputing.com →
            </a>
          </div>
          <div className="rounded-2xl border border-white/12 bg-white/[0.04] px-[26px] py-2">
            {[
              ["Established", "1998"],
              ["Represents", "All SoC undergraduates"],
              ["Faculty", "NUS School of Computing"],
              ["This event", "Flagship hackathon"],
            ].map(([k, v], i, arr) => (
              <div
                key={k}
                className={`flex items-baseline justify-between py-[18px] ${
                  i < arr.length - 1 ? "border-b border-white/10" : ""
                }`}
              >
                <span className="text-[13.5px] text-[#c9964a]">{k}</span>
                <span className="max-w-[60%] text-right text-[14.5px] font-semibold text-white">
                  {v}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------- SPONSORS ---------------- */}
      <section id="sponsors" className="mx-auto max-w-[1180px] px-7 py-20">
        <div className="mb-[38px] flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className={`${eyebrow} mb-4`}>Sponsors &amp; partners</div>
            <h2
              className={`${sectionTitle} max-w-[14em]`}
              style={{ fontSize: "clamp(28px,3.6vw,40px)" }}
            >
              Built alongside industry. Partners announced soon.
            </h2>
          </div>
          <span className="ff-mono rounded-full border border-white/15 px-3.5 py-2 text-[11px] tracking-[0.08em] text-slate-400">
            Partnerships in progress
          </span>
        </div>

        <div className="mb-3.5 ff-mono text-[11px] uppercase tracking-[0.12em] text-white">
          Title sponsor
        </div>
        <div
          className="mb-[34px] flex h-[118px] items-center justify-center rounded-2xl border-[1.5px] border-dashed border-white/20"
          style={{
            background:
              "repeating-linear-gradient(135deg,rgba(255,255,255,0.02) 0 12px,transparent 12px 24px)",
          }}
        >
          <span className="ff-mono text-[13px] text-slate-500">
            To be announced
          </span>
        </div>

        <div className="mb-3.5 ff-mono text-[11px] uppercase tracking-[0.12em] text-white">
          Gold
        </div>
        <div className="mb-[30px] grid grid-cols-2 gap-[18px] md:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="flex h-[92px] items-center justify-center rounded-xl border-[1.5px] border-dashed border-white/15"
            >
              <span className="ff-mono text-[12px] text-slate-600">Logo slot</span>
            </div>
          ))}
        </div>

        <div className="mb-3.5 ff-mono text-[11px] uppercase tracking-[0.12em] text-white">
          Silver
        </div>
        <div className="grid grid-cols-2 gap-[18px] md:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="flex h-[74px] items-center justify-center rounded-xl border-[1.5px] border-dashed border-white/12"
            >
              <span className="ff-mono text-[11px] text-slate-600">Logo slot</span>
            </div>
          ))}
        </div>
      </section>

      {/* ---------------- JUDGES & PROBLEM STATEMENTS ---------------- */}
      <section className="border-t border-white/10 bg-white/[0.02]">
        <div className="mx-auto grid max-w-[1180px] gap-[26px] px-7 py-20 md:grid-cols-2">
          <div className="rounded-2xl border border-white/12 p-[34px]">
            <div className="ff-mono mb-3.5 text-[11px] uppercase tracking-[0.14em] text-[#c9964a]">
              Judges
            </div>
            <h3 className="ff-serif mb-3 text-[25px] font-semibold text-white">
              Judged by industry partners
            </h3>
            <p className="mb-[22px] text-[15.5px] leading-[1.6] text-slate-300">
              Main Hackathon submissions are evaluated by representatives from
              the sponsoring companies. The judging panel is confirmed alongside
              our partners.
            </p>
            <div className="flex flex-wrap gap-3">
              {[0, 1].map((i) => (
                <div
                  key={i}
                  className="flex items-center gap-[11px] rounded-[10px] border border-white/12 px-3.5 py-2.5"
                >
                  <span className="h-[34px] w-[34px] rounded-full border-[1.5px] border-dashed border-white/20 bg-white/5" />
                  <span className="ff-mono text-[12px] text-slate-500">
                    To be announced
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-white/12 bg-[#9a6a2f]/[0.05] p-[34px]">
            <div className="ff-mono mb-3.5 text-[11px] uppercase tracking-[0.14em] text-[#c9964a]">
              Problem statements
            </div>
            <h3 className="ff-serif mb-3 text-[25px] font-semibold text-white">
              Revealed live, on the day
            </h3>
            <p className="mb-[22px] text-[15.5px] leading-[1.6] text-slate-300">
              Problem statements are announced on stage during the event and
              published here within minutes of the reveal. Bookmark this page —
              they'll appear right here.
            </p>
            <div className="flex items-center gap-3.5 rounded-xl border-[1.5px] border-dashed border-[#c9964a]/35 p-[22px]">
              <span
                className="h-2.5 w-2.5 flex-none rounded-full bg-[#c9964a]"
                style={{ boxShadow: "0 0 0 4px rgba(201,150,74,0.15)" }}
              />
              <div>
                <div className="text-[15px] font-semibold text-white">
                  Statements drop on 22 Aug
                </div>
                <div className="mt-0.5 text-[13px] text-slate-500">
                  This panel updates the moment they're announced.
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------- REGISTRATION ---------------- */}
      <section id="register" className="grid-bg relative overflow-hidden">
        {/* marquee backdrop */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 flex flex-col justify-around gap-5 opacity-20"
          style={{
            WebkitMaskImage:
              "linear-gradient(90deg,transparent,#000 12%,#000 88%,transparent)",
            maskImage:
              "linear-gradient(90deg,transparent,#000 12%,#000 88%,transparent)",
          }}
        >
          {[
            { list: [...SIGNUPS_1, ...SIGNUPS_1], anim: "lhmarquee 52s linear infinite" },
            { list: [...SIGNUPS_2, ...SIGNUPS_2], anim: "lhmarquee2 64s linear infinite" },
            { list: [...SIGNUPS_2, ...SIGNUPS_2], anim: "lhmarquee 58s linear infinite" },
            { list: [...SIGNUPS_1, ...SIGNUPS_1], anim: "lhmarquee2 70s linear infinite" },
          ].map((row, ri) => (
            <div
              key={ri}
              className="flex w-max gap-3.5"
              style={{ animation: row.anim }}
            >
              {row.list.map((name, i) => (
                <span
                  key={i}
                  className="inline-flex flex-none items-center gap-2.5 whitespace-nowrap rounded-full border border-white/14 bg-white/5 px-[17px] py-2.5"
                >
                  <span className="h-1.5 w-1.5 flex-none rounded-full bg-emerald-400" />
                  <span className="text-[14px] font-semibold text-white">
                    {name}
                  </span>
                  <span className="text-[13.5px] text-slate-400">
                    just signed up
                  </span>
                </span>
              ))}
            </div>
          ))}
        </div>

        <div className="relative z-[1] mx-auto max-w-[920px] px-7 py-20">
          <div className="mb-9 text-center">
            <div className={`${eyebrow} mb-4`}>Registration</div>
            <h2
              className={`${sectionTitle} mb-3.5`}
              style={{ fontSize: "clamp(30px,4vw,46px)" }}
            >
              Secure your spot
            </h2>
            <p className="mx-auto max-w-[34em] text-[16.5px] leading-[1.55] text-slate-300">
              Two separate forms — one per track. Register right here; there's no
              redirect to a third-party site.
            </p>
          </div>

          <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#0d1118] shadow-[0_30px_70px_-40px_rgba(0,0,0,0.8)]">
            {reg.status === "done" ? (
              <div className="px-9 py-[44px] text-center">
                <div
                  className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-[#9a6a2f]/20 text-[26px]"
                  style={{ color: GOLD }}
                >
                  ✓
                </div>
                <h3 className="ff-serif mb-2.5 text-[26px] font-semibold text-white">
                  You're registered!
                </h3>
                <p className="mx-auto mb-6 max-w-[32em] text-[15.5px] leading-[1.6] text-slate-300">
                  Thanks for signing up for LifeHack 2026. Your check-in QR code
                  is on its way to your inbox — bring it on event day for fast,
                  contactless check-in.
                </p>
                <button
                  onClick={resetReg}
                  className="rounded-[10px] border border-white/15 px-6 py-3 text-[14px] font-semibold text-white transition hover:border-white"
                >
                  Register someone else
                </button>
              </div>
            ) : (
              <>
            {/* tabs */}
            <div className="flex border-b border-white/10">
              {(
                [
                  ["main", "Main Hackathon · Teams"],
                  ["algo", "Algorithmic · Individual"],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => {
                    setRegTab(key);
                    setReg({ status: "idle" });
                  }}
                  className={`flex-1 px-[18px] py-[15px] text-[15px] transition ${
                    regTab === key
                      ? "border-b-2 border-[#c9964a] font-semibold text-white"
                      : "border-b-2 border-transparent font-medium text-slate-500 hover:text-slate-300"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* MAIN TAB */}
            {regTab === "main" && (
              <div className="px-9 py-[34px]">
                <p className="mb-2 text-[15px] leading-[1.55] text-slate-300">
                  The Main Hackathon is team-based. Pick how you're joining —
                  every member keeps their own record, so QR check-in works per
                  person.
                </p>
                <div className="mb-2 mt-[22px] grid grid-cols-1 gap-3 sm:grid-cols-3">
                  {(
                    [
                      ["create", "CAPTAIN", "Create a team", "Get a code to share"],
                      ["join", "MEMBER", "Join a team", "Enter a team code"],
                      ["solo", "SOLO", "Find me a team", "We'll group you"],
                    ] as const
                  ).map(([mode, tag, title, sub]) => (
                    <button
                      key={mode}
                      onClick={() => setMode(mode)}
                      className={pathCard(mainMode === mode)}
                    >
                      <div
                        className="ff-mono mb-[7px] text-[10px] tracking-[0.1em]"
                        style={{ color: GOLD }}
                      >
                        {tag}
                      </div>
                      <div className="mb-[3px] text-[15.5px] font-semibold text-white">
                        {title}
                      </div>
                      <div className="text-[12.5px] leading-[1.4] text-slate-500">
                        {sub}
                      </div>
                    </button>
                  ))}
                </div>

                {mainMode === "create" && (
                  <form
                    onSubmit={createForm.handleSubmit((d) =>
                      submit("Main", { role: "captain", teamCode, ...d })
                    )}
                    className="mt-[18px] border-t border-white/8 pt-6"
                  >
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <Input label="Your name" placeholder="Jane Tan" name="name" required register={createForm.register} />
                      <Input label="Team name" placeholder="Null Pointers" name="teamName" register={createForm.register} />
                      <Input label="Email" placeholder="jane@u.nus.edu" name="email" type="email" required register={createForm.register} />
                      <Input label="University" placeholder="NUS" name="university" register={createForm.register} />
                    </div>
                    <div className="mt-[18px] flex items-center justify-between gap-4 rounded-[10px] border border-[#c9964a]/25 bg-[#9a6a2f]/10 px-[18px] py-4">
                      <div>
                        <div className="ff-mono mb-[5px] text-[10.5px] uppercase tracking-[0.1em] text-slate-400">
                          Your team invite code
                        </div>
                        <div className="ff-mono text-[22px] font-medium tracking-[0.04em] text-white">
                          {teamCode}
                        </div>
                      </div>
                      <span className="max-w-[14em] text-right text-[12.5px] text-slate-500">
                        Share this with teammates so they can join. Min / max team
                        size is enforced before a team is marked complete.
                      </span>
                    </div>
                    <FormFooter
                      sending={reg.status === "sending"}
                      error={reg.status === "error"}
                      label="Create team & register"
                    />
                  </form>
                )}

                {mainMode === "join" && (
                  <form
                    onSubmit={joinForm.handleSubmit((d) =>
                      submit("Main", { role: "member", ...d })
                    )}
                    className="mt-[18px] border-t border-white/8 pt-6"
                  >
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <Input label="Your name" placeholder="Marcus Lee" name="name" required register={joinForm.register} />
                      <Input label="Team code" placeholder="LH26-XXXXXX" mono name="teamCode" required register={joinForm.register} />
                      <Input label="Email" placeholder="marcus@u.nus.edu" name="email" type="email" required register={joinForm.register} />
                      <Input label="University" placeholder="NUS" name="university" register={joinForm.register} />
                    </div>
                    <FormFooter
                      sending={reg.status === "sending"}
                      error={reg.status === "error"}
                      label="Join team & register"
                    />
                  </form>
                )}

                {mainMode === "solo" && (
                  <form
                    onSubmit={soloForm.handleSubmit((d) =>
                      submit("Main", { role: "solo", ...d })
                    )}
                    className="mt-[18px] border-t border-white/8 pt-6"
                  >
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <Input label="Your name" placeholder="Priya R." name="name" required register={soloForm.register} />
                      <Input label="Email" placeholder="priya@u.nus.edu" name="email" type="email" required register={soloForm.register} />
                      <Input
                        label="Skills / what you bring"
                        placeholder="Frontend, ML, design…"
                        full
                        name="skills"
                        register={soloForm.register}
                      />
                    </div>
                    <div className="mt-4 text-[13px] leading-[1.5] text-slate-500">
                      No team? No problem. We'll match you with other solo
                      registrants before the event so everyone has a squad.
                    </div>
                    <FormFooter
                      sending={reg.status === "sending"}
                      error={reg.status === "error"}
                      label="Register & find me a team"
                    />
                  </form>
                )}
              </div>
            )}

            {/* ALGO TAB */}
            {regTab === "algo" && (
              <form
                onSubmit={algoForm.handleSubmit((d) =>
                  submit("Algo", {
                    ...d,
                    warmupLevel: scDone ? result.level : "",
                  })
                )}
                className="px-9 py-[34px]"
              >
                <div className="mb-6 flex items-start gap-3 rounded-[10px] border border-[#c9964a]/25 bg-[#9a6a2f]/10 px-4 py-3.5">
                  <span className="mt-1.5 h-2.5 w-2.5 flex-none rounded-full bg-[#c9964a]" />
                  <p className="text-[13.5px] leading-[1.5] text-slate-300">
                    <strong>~100 seats.</strong> The Algorithmic Hackathon is
                    individual. We pair registration with the optional warm-up
                    above to gauge the range of experience signing up — it helps
                    us plan a fair contest, and informs whether seats can be
                    adjusted.
                  </p>
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Input label="Full name" placeholder="Wei Jie" name="name" required register={algoForm.register} />
                  <Input label="Email" placeholder="weijie@u.nus.edu" name="email" type="email" required register={algoForm.register} />
                  <Input label="University" placeholder="NUS" name="university" register={algoForm.register} />
                  <Input label="Codeforces handle (optional)" placeholder="@handle" name="codeforces" register={algoForm.register} />
                </div>
                <div className="mt-4 flex items-center gap-3 rounded-[10px] border border-white/12 px-4 py-3.5">
                  <span className="inline-flex h-5 w-5 flex-none items-center justify-center rounded-[5px] border-[1.5px] border-[#c9964a] bg-[#c9964a] text-[12px] text-white">
                    ✓
                  </span>
                  <span className="text-[14px] text-slate-300">
                    I've completed the{" "}
                    <a
                      href="#algorithmic"
                      className="font-semibold"
                      style={{ color: GOLD }}
                    >
                      2-minute warm-up
                    </a>{" "}
                    above <span className="text-slate-500">(optional, but encouraged)</span>
                  </span>
                </div>
                <FormFooter
                  sending={reg.status === "sending"}
                  error={reg.status === "error"}
                  label="Register for the Algorithmic Hackathon"
                />
              </form>
            )}
              </>
            )}
          </div>
          <p className="ff-mono mt-[18px] text-center text-[12.5px] text-slate-500">
            Your registration links to a QR code for fast, contactless check-in
            on event day.
          </p>
        </div>
      </section>

      {/* ---------------- FAQ ---------------- */}
      <section id="faq" className="mx-auto max-w-[840px] px-7 py-[84px]">
        <div className="mb-10 text-center">
          <div className={`${eyebrow} mb-3.5`}>FAQ</div>
          <h2 className={sectionTitle} style={{ fontSize: "clamp(30px,4vw,44px)" }}>
            Questions, answered
          </h2>
        </div>
        <div className="flex flex-col border-t border-white/12">
          {FAQS.map((f, i) => {
            const open = faqOpen === i;
            return (
              <div key={f.q} className="border-b border-white/12">
                <button
                  onClick={() => setFaqOpen(open ? -1 : i)}
                  className="flex w-full items-center justify-between gap-[18px] px-1 py-[22px] text-left"
                >
                  <span className="ff-serif text-[19px] font-medium text-white">
                    {f.q}
                  </span>
                  <span
                    className="ff-mono w-6 flex-none text-center text-[22px]"
                    style={{ color: GOLD }}
                  >
                    {open ? "−" : "+"}
                  </span>
                </button>
                {open && (
                  <p className="max-w-[60em] px-1 pb-6 text-[16px] leading-[1.62] text-slate-400">
                    {f.a}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* ---------------- FOOTER ---------------- */}
      <footer className="bg-[#0a0d14] text-white">
        <div className="mx-auto max-w-[1180px] px-7 pb-10 pt-[60px]">
          <div className="flex flex-wrap items-start justify-between gap-8">
            <div className="max-w-[24em]">
              <div className="mb-4 flex items-center gap-3">
                <span className="inline-flex items-center justify-center rounded-[9px] bg-white px-2.5 py-[7px]">
                  <img src={LOGO} alt="NUS Computing Club" className="block h-[30px] w-auto" />
                </span>
                <span className="ff-serif text-[19px] font-semibold">
                  LifeHack 2026
                </span>
              </div>
              <p className="text-[14.5px] leading-[1.6] text-slate-400">
                The flagship hackathon of the NUS Students' Computing Club — the
                official faculty club of the NUS School of Computing since 1998.
                22–23 August 2026, COM3 MPH.
              </p>
            </div>
            <div className="flex flex-wrap gap-14">
              <div>
                <div className="ff-mono mb-3.5 text-[10.5px] uppercase tracking-[0.14em] text-[#c9964a]">
                  Event
                </div>
                <div className="flex flex-col gap-2.5">
                  {[
                    ["About", "#about"],
                    ["Tracks", "#tracks"],
                    ["Algorithmic", "#algorithmic"],
                    ["Register", "#register"],
                  ].map(([l, h]) => (
                    <a
                      key={h}
                      href={h}
                      className="text-[14.5px] text-slate-300 hover:text-white"
                    >
                      {l}
                    </a>
                  ))}
                </div>
              </div>
              <div>
                <div className="ff-mono mb-3.5 text-[10.5px] uppercase tracking-[0.14em] text-[#c9964a]">
                  Organiser
                </div>
                <div className="flex flex-col gap-2.5">
                  <a
                    href="https://nuscomputing.com/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[14.5px] text-slate-300 hover:text-white"
                  >
                    NUS Students' Computing Club →
                  </a>
                  <a href="#organiser" className="text-[14.5px] text-slate-300 hover:text-white">
                    About the club
                  </a>
                  <a href="#faq" className="text-[14.5px] text-slate-300 hover:text-white">
                    FAQ
                  </a>
                  <a href={links.email} className="text-[14.5px] text-slate-300 hover:text-white">
                    connect@nuscomputing.com
                  </a>
                </div>
              </div>
            </div>
          </div>
          <div className="mt-11 flex flex-wrap justify-between gap-3 border-t border-white/10 pt-6">
            <span className="ff-mono text-[11.5px] text-slate-500">
              © 2026 NUS Computing Club
            </span>
            <span className="ff-mono text-[11.5px] text-slate-500">
              Logo &amp; full visual identity — pending
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
