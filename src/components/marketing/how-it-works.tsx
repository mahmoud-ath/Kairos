/**
 * Four-step getting-started section.
 *
 * Numbered because the order is real: there is nothing to organise before you
 * have an account, habits only make sense once there is a day to put them in,
 * and the statistics page has nothing to show until something is ticked off.
 */
const STEPS = [
  {
    title: "Create an account",
    description:
      "An email address or a Google account, and you are in. No payment, no setup, no waiting for approval.",
  },
  {
    title: "Plan the day",
    description:
      "Add tasks, give them a category, a day or a due date, and drag them into the order that matches what matters.",
  },
  {
    title: "Keep the habits",
    description:
      "Choose the weekdays each habit is due. Today's instance shows up in Today, a missed day stays missed, and the month grid is there when you want the bigger picture.",
  },
  {
    title: "Read the week",
    description:
      "Statistics show completions over the last 7 or 30 days by category, and habits get their own trend. Switch on the daily reminder if you want a nudge.",
  },
] as const;

export function HowItWorks() {
  return (
    <section id="how-it-works" className="scroll-mt-20 border-t border-border/70">
      <div className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold text-primary">Getting started</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
            Four steps, about a minute
          </h2>
          <p className="mt-3 text-base leading-relaxed text-muted-foreground">
            There is nothing to configure first. Your workspace starts empty and fills up
            as you use it.
          </p>
        </div>

        <ol className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step, index) => (
            <li key={step.title} className="relative">
              <span className="grid h-8 w-8 place-items-center rounded-full border border-primary/25 bg-primary/10 text-sm font-semibold text-primary">
                {index + 1}
              </span>
              <h3 className="mt-4 text-base font-semibold tracking-tight">{step.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                {step.description}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
