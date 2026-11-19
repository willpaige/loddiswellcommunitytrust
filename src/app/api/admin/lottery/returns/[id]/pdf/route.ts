import { NextResponse } from "next/server";
import { getLotteryReturn } from "@/actions/lottery-return";
import { buildLotteryReturnPdf, lotteryReturnFilename } from "@/lib/lottery/return/service";

export const dynamic = "force-dynamic";

// The return as it stands now, rendered fresh from the records.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let loaded;
  try {
    loaded = await getLotteryReturn(id);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!loaded) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const pdf = await buildLotteryReturnPdf(loaded);
  const inline = new URL(req.url).searchParams.has("view");
  return new NextResponse(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${lotteryReturnFilename(loaded)}"`,
      "Cache-Control": "no-store",
    },
  });
}
