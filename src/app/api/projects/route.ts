import { getProjects } from "@/lib/actions/projects";
import { NextResponse } from "next/server";

export async function GET() {
  const projects = await getProjects();
  return NextResponse.json(projects);
}
