"use client";

import Image from "next/image";
import { MOED_OS_PEOPLE, MOED_OS_TITLE } from "@/data/moed-os";

export default function MoedOsPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-6">
      <header className="mb-6 text-center">
        <h1 className="text-2xl font-bold text-slate-800">Mød os</h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">{MOED_OS_TITLE}</p>
      </header>

      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
        {MOED_OS_PEOPLE.map((person) => (
          <li
            key={person.image}
            className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
          >
            <div className="relative aspect-square w-full bg-slate-100">
              <Image
                src={person.image}
                alt={person.name}
                fill
                sizes="(max-width: 640px) 50vw, 33vw"
                className="object-cover object-top"
              />
            </div>
            <p className="px-2 py-2.5 text-center text-sm font-semibold text-slate-800">{person.name}</p>
          </li>
        ))}
      </ul>
    </main>
  );
}
