import { ChevronDown } from "lucide-react";

/**
 * Frequently asked questions.
 *
 * Built on native `<details>`/`<summary>`, so disclosure works with the keyboard
 * and with assistive technology without shipping any JavaScript.
 *
 * The answers draw the hosted/self-hosted distinction explicitly: the hosted
 * version stores your tasks in a PostgreSQL database run by the service, so it
 * would be wrong to imply the data never leaves your machine.
 */
const QUESTIONS = [
  {
    question: "Is Kairos free?",
    answer:
      "Yes. The hosted version is free to use, and the source code is MIT licensed, so you can run your own copy without paying anything to anyone.",
  },
  {
    question: "Do I need an account?",
    answer:
      "For the hosted version, yes — an email address or a Google account. That account is what gives you a private workspace, so your tasks are kept separate from everyone else's. If you self-host, you run the app against your own database and decide for yourself whether sign-in is required.",
  },
  {
    question: "Can I self-host it?",
    answer:
      "Yes. Kairos is a standard Next.js server plus a PostgreSQL database, and the whole thing is MIT licensed. Point it at your own database and deploy it wherever you like — a VPS, a home server, or a container on your own hardware.",
  },
  {
    question: "Is my data private?",
    answer:
      "Each account has its own private workspace, and that separation is enforced in the data layer rather than only in the interface — one account cannot read another's tasks. On the hosted version your tasks live in a PostgreSQL database operated by the service; they are not stored only on your device. If you would rather keep every byte on hardware you control, self-host.",
  },
  {
    question: "What can I organise tasks by?",
    answer:
      "Categories and dates. A task belongs to one category, can be scheduled for a day, can carry a due date, and can have one level of subtasks. There are deliberately no labels and no priorities: the category is the only grouping, which is what keeps the decision about what to do next quick.",
  },
] as const;

export function Faq() {
  return (
    <section id="faq" className="scroll-mt-20 border-t border-border/70 bg-muted/30">
      <div className="mx-auto w-full max-w-3xl px-4 py-20 sm:px-6 sm:py-28">
        <p className="text-sm font-semibold text-primary">FAQ</p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
          Common questions
        </h2>

        <div className="mt-10 divide-y divide-border rounded-lg border border-border bg-card">
          {QUESTIONS.map((item) => (
            <details key={item.question} className="group px-5">
              <summary className="flex cursor-pointer list-none items-center gap-4 py-4 text-left text-sm font-medium marker:content-none [&::-webkit-details-marker]:hidden">
                <span className="flex-1">{item.question}</span>
                <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground motion-safe:transition-transform motion-safe:duration-200 group-open:rotate-180" />
              </summary>
              <p className="pb-5 pr-8 text-sm leading-relaxed text-muted-foreground">
                {item.answer}
              </p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
