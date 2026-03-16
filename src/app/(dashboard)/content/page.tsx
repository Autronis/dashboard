"use client";

import Link from "next/link";
import { BookOpen, Newspaper } from "lucide-react";

export default function ContentPage() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-autronis-text-primary">Content Engine</h1>
        <p className="text-autronis-text-secondary mt-1">
          Beheer je kennisbank en genereer social media content voor Autronis.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Link
          href="/content/kennisbank"
          className="group bg-autronis-card border border-autronis-border rounded-2xl p-6 card-glow transition-all hover:border-autronis-accent/50 flex flex-col gap-3"
        >
          <div className="w-12 h-12 rounded-xl bg-autronis-accent/10 flex items-center justify-center">
            <BookOpen className="w-6 h-6 text-autronis-accent" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-autronis-text-primary group-hover:text-autronis-accent transition-colors">
              Kennisbank
            </h2>
            <p className="text-sm text-autronis-text-secondary mt-1">
              Autronis profiel, tone of voice, USPs en projectinzichten opslaan.
            </p>
          </div>
        </Link>

        <Link
          href="/content/posts"
          className="group bg-autronis-card border border-autronis-border rounded-2xl p-6 card-glow transition-all hover:border-autronis-accent/50 flex flex-col gap-3"
        >
          <div className="w-12 h-12 rounded-xl bg-autronis-accent/10 flex items-center justify-center">
            <Newspaper className="w-6 h-6 text-autronis-accent" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-autronis-text-primary group-hover:text-autronis-accent transition-colors">
              Posts
            </h2>
            <p className="text-sm text-autronis-text-secondary mt-1">
              AI-gegenereerde LinkedIn en Instagram posts beheren en publiceren.
            </p>
          </div>
        </Link>
      </div>
    </div>
  );
}
