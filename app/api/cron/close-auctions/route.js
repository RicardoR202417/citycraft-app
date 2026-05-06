import { NextResponse } from "next/server";
import { getSupabaseServiceClient } from "../../../../lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(request) {
  const authHeader = request.headers.get("authorization");
  const expectedHeader = `Bearer ${process.env.CRON_SECRET}`;

  if (!process.env.CRON_SECRET || authHeader !== expectedHeader) {
    return NextResponse.json(
      {
        error: "Unauthorized"
      },
      { status: 401 }
    );
  }

  const supabase = getSupabaseServiceClient();
  const { data, error } = await supabase.rpc("close_expired_auctions", {
    p_limit: 50
  });

  if (error) {
    return NextResponse.json(
      {
        error: "Could not close expired auctions",
        details: error.message
      },
      { status: 500 }
    );
  }

  const closedAuctions = Array.isArray(data) ? data : [];

  return NextResponse.json({
    closedCount: closedAuctions.length,
    closedAuctions,
    ok: true
  });
}
