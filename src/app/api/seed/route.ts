import { NextResponse } from "next/server";
import { seed } from "@/lib/db/seed";

export async function POST() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "Seeding is not allowed in production" },
      { status: 403 }
    );
  }

  try {
    await seed();
    return NextResponse.json({ success: true, message: "Database seeded successfully" });
  } catch (error) {
    console.error("Seed error:", error);
    return NextResponse.json(
      { error: "Seeding failed", details: String(error) },
      { status: 500 }
    );
  }
}
