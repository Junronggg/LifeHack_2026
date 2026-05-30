const events = [
  {
    time: '09:00',
    title: 'Registration Opens',
    description: 'Participants check in and collect event materials.',
  },
  {
    time: '10:00',
    title: 'Opening Ceremony',
    description: 'Welcome address, sponsor introductions, and challenge briefing.',
  },
  {
    time: '11:00',
    title: 'Hacking Begins',
    description: 'Teams start building their solutions.',
  },
  {
    time: '18:00',
    title: 'Dinner and Mentor Check-in',
    description: 'Teams get feedback from mentors and sponsors.',
  },
  {
    time: 'Next Day',
    title: 'Submission and Judging',
    description: 'Teams submit their projects and present to judges.',
  },
];

export default function Timeline() {
  return (
    <section id="timeline" className="bg-slate-900/60 px-6 py-24">
      <div className="mx-auto max-w-6xl">
        <div className="mb-12 text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-cyan-300">
            Event Schedule
          </p>
          <h2 className="mt-3 text-4xl font-bold">Easy-to-Scan Timetable</h2>
        </div>

        <div className="space-y-4">
          {events.map((event) => (
            <div
              key={event.title}
              className="grid gap-4 rounded-2xl border border-white/10 bg-white/5 p-6 md:grid-cols-[120px_1fr]"
            >
              <div className="font-mono text-cyan-300">{event.time}</div>
              <div>
                <h3 className="text-xl font-semibold">{event.title}</h3>
                <p className="mt-2 text-slate-300">{event.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}