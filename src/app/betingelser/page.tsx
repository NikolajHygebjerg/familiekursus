import Link from "next/link";
import AuthBranding from "@/components/AuthBranding";
import { USER_TERMS_VERSION } from "@/lib/user-terms";

export const metadata = {
  title: "Betingelser for brug af appen | Familiekursus",
  description: "Hvor og hvordan oplysninger om familiers brug af familiekursus-appen behandles.",
};

export default function BetingelserPage() {
  return (
    <main className="min-h-screen p-6 pb-16">
      <div className="mx-auto max-w-2xl">
        <div className="mb-8">
          <AuthBranding />
        </div>
        <h1 className="mb-2 text-2xl font-bold text-slate-800">Betingelser for brug af appen</h1>
        <p className="mb-8 text-sm text-slate-500">Gældende version: {USER_TERMS_VERSION}</p>

        <article className="prose prose-slate max-w-none space-y-6 text-slate-700">
          <section>
            <h2 className="text-lg font-semibold text-slate-800">Hvem er dataansvarlig?</h2>
            <p>
              Brandbjerg Højskole (herefter «højskolen») er dataansvarlig for de oplysninger, I indtaster
              i familiekursus-appen, når I opretter en familie og tilmelder workshops.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-800">Hvilke oplysninger gemmes?</h2>
            <p>I appen kan følgende oplysninger om jeres familie blive registreret:</p>
            <ul className="list-disc space-y-1 pl-5">
              <li>Brugernavn og kode til login (koden gemmes, så I kan logge ind igen)</li>
              <li>Fornavn og alder på familiemedlemmer, I tilmelder</li>
              <li>Workshopvalg og andre tilmeldinger I foretager i appen</li>
            </ul>
            <p>
              Vi bruger ikke e-mailadresse som brugernavn eller login i appen. Det gør vi for at
              begrænse indsamling af personhenførbare kontaktoplysninger.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-800">Hvor opbevares oplysningerne?</h2>
            <p>
              Data lagres i en sikret database hos Supabase (hostet i Frankfurt, Tyskland, EU), som
              højskolen bruger til at administrere familiekursus. Appen kører på Vercel og henter kun de
              data, der er nødvendige for at vise jeres tilmeldinger og program.
            </p>
            <p>
              Oplysningerne bruges udelukkende til planlægning og gennemførelse af familiekursus,
              kapacitet på workshops og overblik for jer som familie — ikke til markedsføring.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-800">Hvem kan se dataene?</h2>
            <p>
              Jeres familie kan se egne tilmeldinger, når I er logget ind. Højskolen og autoriserede
              hjælpere kan se data i administrationsøjemed (fx workshopoversigt og gruppefordeling).
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-800">Opbevaring og sletning</h2>
            <p>
              Data opbevares, så længe det er nødvendigt for det aktuelle kursusår og den afvikling,
              højskolen er ansvarlig for. I kan afmelde jeres familie ved at logge ind med koden Slet,
              hvorefter familiens deltagerdata og login kan fjernes fra databasen, og workshoppladser
              frigives.
            </p>
            <p>
              Har I spørgsmål til jeres data eller ønsker rettelse/sletning uden at bruge «Slet», kan I
              kontakte kursuslederen på{" "}
              <a
                href="mailto:nh@brandbjerg.dk"
                className="font-medium text-amber-700 underline hover:text-amber-800"
              >
                nh@brandbjerg.dk
              </a>
              .
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-800">Cookies og lokal lagring</h2>
            <p>
              Appen gemmer jeres login lokalt i browseren (localStorage), så I ikke behøver logge ind ved
              hvert besøg, når I bruger appen fra en enhed, I stoler på. Der sættes ikke reklame-cookies
              via appen.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-800">Accept</h2>
            <p>
              Ved at afkrydse accept på «Opret familie» bekræfter I, at I har læst disse betingelser og
              giver samtykke til, at oplysningerne behandles som beskrevet, for at I kan bruge appen.
            </p>
          </section>
        </article>

        <p className="mt-10 text-center text-sm text-slate-600">
          <Link href="/velkommen" className="font-medium text-amber-600 hover:text-amber-700 hover:underline">
            Tilbage til opret familie
          </Link>
          {" · "}
          <Link href="/log-ind" className="font-medium text-amber-600 hover:text-amber-700 hover:underline">
            Log ind
          </Link>
        </p>
      </div>
    </main>
  );
}
