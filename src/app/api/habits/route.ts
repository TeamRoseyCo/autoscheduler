import { getHabits } from "@/lib/actions/habits";
import { NextResponse } from "next/server";

export async function GET() {
  const habits = await getHabits();
  return NextResponse.json(habits);
}
