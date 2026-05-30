import { useEffect, useState } from "react";
import "./App.css";
import { links } from "./lib/links";

const EVENT_START = new Date("2026-08-21T09:00:00+08:00").getTime();

function getCountdown() {
  const diff = EVENT_START - Date.now();

  if (diff <= 0) {
    return {
      days: "00",
      hours: "00",
      minutes: "00",
      seconds: "00",
    };
  }

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor(
    (diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)
  );
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);

  return {
    days: String(days).padStart(2, "0"),
    hours: String(hours).padStart(2, "0"),
    minutes: String(minutes).padStart(2, "0"),
    seconds: String(seconds).padStart(2, "0"),
  };
}

const tracks = [
  {
    title: "Main Hackathon",
    description:
      "Build a working product around a real-world brief. Teams will be judged on product thinking, technical execution, architecture, and demo quality.",
    points: [
      "72-hour product build",
      "Partner and sponsor briefs",
      "Mentor office hours",
      "Final demo and code review",
    ],
    link: links.mainHackathonSignup,
  },
  {
    title: "Algorithmic Hackathon",
    description:
      "Compete in a technical problem-solving track focused on algorithms, data structures, optimisation, and rigorous coding under time pressure.",
    points: [
      "Algorithm-focused challenges",
      "Competitive programming style",
      "Clear scoring and ranking",
      "Great for problem solvers",
    ],
    link: links.algorithmicHackathonSignup,
  },
];

const schedule = [
  {
    day: "Day 01",
    date: "Fri, 21 Aug",
    items: [
      ["09:00", "Opening keynote & event briefing"],
      ["11:00", "Team formation & track confirmation"],
      ["14:00", "Technical workshops"],
      ["20:00", "Mentor office hours begin"],
    ],
  },
  {
    day: "Day 02",
    date: "Sat, 22 Aug",
    items: [
      ["10:00", "Architecture review checkpoint"],
      ["15:00", "Mid-hack progress check"],
      ["19:00", "Industry sharing session"],
    ],
  },
  {
    day: "Day 03",
    date: "Sun, 23 Aug",
    items: [
      ["09:00", "Code freeze"],
      ["11:00", "Judging round 1"],
      ["15:00", "Finalist demos"],
      ["18:00", "Awards & closing"],
    ],
  },
];

const faqs = [
  {
    question: "Who can participate?",
    answer:
      "LifeHack is open to students interested in building, coding, design, product development, and problem-solving.",
  },
  {
    question: "Do I need a team?",
    answer:
      "You may register with a team. Team formation support may also be available for individual participants.",
  },
  {
    question: "How are the two tracks different?",
    answer:
      "The Main Hackathon focuses on product building, while the Algorithmic Hackathon focuses on technical problem-solving.",
  },
  {
    question: "Is the event in-person?",
    answer:
      "LifeHack 2026 is planned as an in-person event at NUS School of Computing.",
  },
];

function App() {
  const [countdown, setCountdown] = useState(getCountdown());

  useEffect(() => {
    const timer = window.setInterval(() => {
      setCountdown(getCountdown());
    }, 1000);

    return () => window.clearInterval(timer);
  }, []);

  return (
    <main className="min-h-screen bg-[#05070a] text-white">
      <nav className="fixed left-0 top-0 z-50 w-full border-b border-white/10 bg-[#05070a]/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <a href="#" className="text-sm font-bold tracking-[0.25em]">
            LIFEHACK / 26
          </a>

          <div className="hidden items-center gap-7 md:flex">
            <a href="#about" className="text-sm text-slate-300 hover:text-white">
              About
            </a>
            <a href="#tracks" className="text-sm text-slate-300 hover:text-white">
              Tracks
            </a>
            <a href="#schedule" className="text-sm text-slate-300 hover:text-white">
              Schedule
            </a>
            <a href="#faq" className="text-sm text-slate-300 hover:text-white">
              FAQ
            </a>
          </div>

          <a
            href="#signup"
            className="rounded-full border border-[#9a6a2f] px-4 py-2 text-sm font-semibold text-[#c9964a] transition hover:bg-[#9a6a2f] hover:text-white"
          >
            Apply
          </a>
        </div>
      </nav>

      <section className="relative mx-auto flex min-h-screen max-w-6xl flex-col justify-center px-6 pt-24">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,_rgba(154,106,47,0.25),_transparent_32%),radial-gradient(circle_at_bottom_right,_rgba(201,150,74,0.12),_transparent_30%)]" />

        <div className="mb-5 flex items-center gap-3">
          <span className="h-2.5 w-2.5 rounded-full bg-[#9a6a2f]" />
          <p className="text-xs uppercase tracking-[0.35em] text-slate-300">
            Registrations open · Cohort 12
          </p>
        </div>

        <h1 className="max-w-4xl text-4xl font-bold leading-tight tracking-[-0.04em] md:text-6xl">
          A hackathon built like a conference.
        </h1>

        <p className="mt-6 max-w-3xl text-base leading-7 text-slate-300 md:text-lg">
          LifeHack 2026 is the flagship hackathon of the NUS Students&apos;
          Computing Club. Seventy-two hours, two competition tracks, and the
          engineering standards of a working software team.
        </p>

        <div className="mt-10 grid max-w-3xl gap-4 border-y border-white/10 py-6 sm:grid-cols-3">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-slate-500">
              Dates
            </p>
            <p className="mt-2 text-xl font-semibold">21–23 Aug</p>
          </div>

          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-slate-500">
              Format
            </p>
            <p className="mt-2 text-xl font-semibold">In-person</p>
          </div>

          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-slate-500">
              Venue
            </p>
            <p className="mt-2 text-xl font-semibold">NUS SoC</p>
          </div>
        </div>

        <div className="mt-8">
          <p className="text-sm text-[#c9964a]">
            Opening keynote — 21 Aug 2026, 09:00 SGT
          </p>

          <p className="mt-5 text-xs uppercase tracking-[0.3em] text-slate-500">
            T-minus
          </p>

          <div className="mt-3 grid max-w-xl grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              [countdown.days, "Days"],
              [countdown.hours, "Hours"],
              [countdown.minutes, "Minutes"],
              [countdown.seconds, "Seconds"],
            ].map(([value, label]) => (
              <div
                key={label}
                className="rounded-2xl border border-white/10 bg-white/[0.04] p-4"
              >
                <p className="text-2xl font-bold text-white">{value}</p>
                <p className="mt-1 text-xs uppercase tracking-[0.2em] text-slate-500">
                  {label}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-10 flex flex-col gap-4 sm:flex-row">
          <a
            href="#signup"
            className="rounded-full bg-[#9a6a2f] px-6 py-3 text-center text-sm font-semibold text-white transition hover:bg-[#c9964a]"
          >
            Register a team
          </a>

          <a
            href="#about"
            className="rounded-full border border-white/15 px-6 py-3 text-center text-sm font-semibold text-white transition hover:border-[#9a6a2f] hover:text-[#c9964a]"
          >
            Read the brief →
          </a>
        </div>
      </section>

      <section id="about" className="mx-auto max-w-6xl px-6 py-24">
        <p className="text-sm font-semibold uppercase tracking-[0.25em] text-[#c9964a]">
          01 · The Brief
        </p>

        <div className="mt-6 grid gap-10 md:grid-cols-[0.9fr_1.1fr]">
          <h2 className="text-3xl font-bold tracking-[-0.03em] md:text-5xl">
            Engineering, not improvisation.
          </h2>

          <div className="space-y-5 text-base leading-7 text-slate-300">
            <p>
              LifeHack has historically been a celebration of student energy.
              For our twelfth edition, we are shaping it into a focused
              engineering experience with structured milestones, mentor support,
              and clear technical expectations.
            </p>

            <p>
              Participants will choose between the Main Hackathon and the
              Algorithmic Hackathon. The Main Hackathon rewards product thinking
              and software execution, while the Algorithmic Hackathon rewards
              precision, speed, and problem-solving depth.
            </p>
          </div>
        </div>

        <div className="mt-12 grid gap-4 sm:grid-cols-3">
          {[
            ["72h", "structured build time"],
            ["2", "competition tracks"],
            ["$25K", "prize allocation"],
          ].map(([value, label]) => (
            <div
              key={label}
              className="rounded-3xl border border-white/10 bg-white/[0.03] p-6"
            >
              <p className="text-4xl font-bold text-[#c9964a]">{value}</p>
              <p className="mt-2 text-sm text-slate-400">{label}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="tracks" className="mx-auto max-w-6xl px-6 py-24">
        <p className="text-sm font-semibold uppercase tracking-[0.25em] text-[#c9964a]">
          02 · Tracks
        </p>

        <h2 className="mt-6 text-3xl font-bold tracking-[-0.03em] md:text-5xl">
          Two ways to compete.
        </h2>

        <div className="mt-10 grid gap-6 md:grid-cols-2">
          {tracks.map((track) => (
            <article
              key={track.title}
              className="rounded-3xl border border-white/10 bg-white/[0.04] p-7 transition hover:border-[#9a6a2f] hover:bg-white/[0.06]"
            >
              <h3 className="text-2xl font-bold">{track.title}</h3>

              <p className="mt-4 leading-7 text-slate-300">
                {track.description}
              </p>

              <ul className="mt-6 space-y-3">
                {track.points.map((point) => (
                  <li key={point} className="text-sm text-slate-300">
                    <span className="mr-2 text-[#c9964a]">✦</span>
                    {point}
                  </li>
                ))}
              </ul>

              <a
                href={track.link}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-7 inline-block rounded-full bg-[#9a6a2f] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#c9964a]"
              >
                Sign up →
              </a>
            </article>
          ))}
        </div>
      </section>

      <section id="schedule" className="bg-white/[0.025] px-6 py-24">
        <div className="mx-auto max-w-6xl">
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-[#c9964a]">
            03 · Schedule
          </p>

          <h2 className="mt-6 text-3xl font-bold tracking-[-0.03em] md:text-5xl">
            Three days, tightly run.
          </h2>

          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {schedule.map((day) => (
              <div
                key={day.day}
                className="rounded-3xl border border-white/10 bg-[#05070a] p-6"
              >
                <p className="text-sm font-semibold text-[#c9964a]">
                  {day.day}
                </p>
                <h3 className="mt-2 text-xl font-bold">{day.date}</h3>

                <div className="mt-6 space-y-4">
                  {day.items.map(([time, title]) => (
                    <div
                      key={`${time}-${title}`}
                      className="grid grid-cols-[60px_1fr] gap-4 border-t border-white/10 pt-4"
                    >
                      <p className="text-sm text-slate-500">{time}</p>
                      <p className="text-sm text-slate-200">{title}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="signup" className="mx-auto max-w-6xl px-6 py-24 text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.25em] text-[#c9964a]">
          Applications close 25 July 2026
        </p>

        <h2 className="mx-auto mt-6 max-w-3xl text-4xl font-bold tracking-[-0.04em] md:text-6xl">
          Build something worth shipping.
        </h2>

        <p className="mx-auto mt-6 max-w-2xl leading-7 text-slate-300">
          Choose the Main Hackathon if you want to build a product. Choose the
          Algorithmic Hackathon if you want to solve technical challenges.
        </p>

        <div className="mt-10 flex flex-col justify-center gap-4 sm:flex-row">
          <a
            href={links.mainHackathonSignup}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full bg-[#9a6a2f] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#c9964a]"
          >
            Main Hackathon →
          </a>

          <a
            href={links.algorithmicHackathonSignup}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full border border-white/15 px-6 py-3 text-sm font-semibold text-white transition hover:border-[#9a6a2f] hover:text-[#c9964a]"
          >
            Algorithmic Hackathon →
          </a>
        </div>
      </section>

      <section id="faq" className="mx-auto max-w-6xl px-6 py-24">
        <p className="text-sm font-semibold uppercase tracking-[0.25em] text-[#c9964a]">
          04 · Questions
        </p>

        <h2 className="mt-6 text-3xl font-bold tracking-[-0.03em] md:text-5xl">
          Frequently asked.
        </h2>

        <div className="mt-10 divide-y divide-white/10 border-y border-white/10">
          {faqs.map((faq) => (
            <details key={faq.question} className="group py-6">
              <summary className="flex cursor-pointer list-none items-center justify-between text-lg font-semibold">
                <span>{faq.question}</span>
                <span className="text-[#c9964a] transition group-open:rotate-45">
                  +
                </span>
              </summary>
              <p className="mt-4 max-w-3xl leading-7 text-slate-400">
                {faq.answer}
              </p>
            </details>
          ))}
        </div>
      </section>

      <footer className="border-t border-white/10 px-6 py-10">
        <div className="mx-auto grid max-w-6xl gap-6 md:grid-cols-2">
          <div>
            <p className="text-sm font-bold tracking-[0.25em]">LIFEHACK / 26</p>
            <p className="mt-3 text-sm text-slate-400">
              Organised by NUS Students&apos; Computing Club.
            </p>
          </div>

          <div className="text-sm text-slate-400 md:text-right">
            <p>NUS School of Computing</p>
            <p>13 Computing Drive, Singapore 117417</p>
            <a
              href={links.email}
              className="mt-2 inline-block text-[#c9964a] hover:text-white"
            >
              connect@nuscomputing.com
            </a>
            <p className="mt-3">© 2026 NUSCC</p>
          </div>
        </div>
      </footer>
    </main>
  );
}

export default App;