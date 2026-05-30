import { links } from "../lib/links";

const tracks = [
  {
    title: "Main Hackathon",
    description:
      "Build innovative products, prototypes, and solutions around real-world challenges with your team.",
    points: [
      "Product-focused",
      "Beginner-friendly",
      "Startup and sponsor challenges",
    ],
    signupLink: links.mainHackathonSignup,
  },
  {
    title: "Algorithmic Hackathon",
    description:
      "Solve algorithmic and technical challenges in a more competitive programming-style format.",
    points: [
      "Algorithm-focused",
      "Problem-solving intensive",
      "Great for CS and coding enthusiasts",
    ],
    signupLink: links.algorithmicHackathonSignup,
  },
];

export default function Tracks() {
  return (
    <section id="tracks" className="mx-auto max-w-6xl px-6 py-24">
      <div className="mb-12 text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-cyan-300">
          Two Tracks
        </p>
        <h2 className="mt-3 text-4xl font-bold">
          Choose Your LifeHack Experience
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-slate-300">
          Pick the track that best matches your interests, skill set, and goals.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {tracks.map((track) => (
          <div
            key={track.title}
            className="rounded-3xl border border-white/10 bg-white/5 p-8 shadow-2xl backdrop-blur"
          >
            <h3 className="text-2xl font-bold">{track.title}</h3>

            <p className="mt-4 text-slate-300">{track.description}</p>

            <ul className="mt-6 space-y-3">
              {track.points.map((point) => (
                <li key={point} className="text-slate-200">
                  ✦ {point}
                </li>
              ))}
            </ul>

            <a
              href={track.signupLink}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-8 inline-block rounded-full bg-cyan-400 px-5 py-3 font-semibold text-slate-950 transition hover:bg-cyan-300"
            >
              Sign up for {track.title}
            </a>
          </div>
        ))}
      </div>
    </section>
  );
}