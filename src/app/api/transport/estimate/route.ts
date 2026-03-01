import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "no_key" }, { status: 400 });
  }

  try {
    const body = await request.json();
    const { from, to, departureTime, modes } = body as {
      from: string;
      to: string;
      departureTime?: string;
      modes: string[];
    };

    if (!from || !to || !Array.isArray(modes) || modes.length === 0) {
      return NextResponse.json(
        { error: "from, to, and modes are required" },
        { status: 400 }
      );
    }

    const results: Record<string, number | null> = {};

    await Promise.all(
      modes.map(async (mode) => {
        try {
          const params = new URLSearchParams({
            origins: from,
            destinations: to,
            mode,
            key: apiKey,
          });

          // Add departure_time for traffic-aware estimates on driving
          if (mode === "driving" && departureTime) {
            const unix = Math.floor(new Date(departureTime).getTime() / 1000);
            params.set("departure_time", String(unix));
          }

          const url = `https://maps.googleapis.com/maps/api/distancematrix/json?${params.toString()}`;
          const res = await fetch(url);
          const data = await res.json();

          const element = data?.rows?.[0]?.elements?.[0];
          if (!element || element.status !== "OK") {
            results[mode] = null;
            return;
          }

          // Prefer duration_in_traffic (driving with departure_time), else duration
          const durationSeconds =
            element.duration_in_traffic?.value ?? element.duration?.value;

          results[mode] =
            typeof durationSeconds === "number"
              ? Math.ceil(durationSeconds / 60)
              : null;
        } catch {
          results[mode] = null;
        }
      })
    );

    return NextResponse.json(results);
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Failed to estimate travel time";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
