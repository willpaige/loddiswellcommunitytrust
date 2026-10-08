import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { authorizeRequirementUpload } from "@/actions/booking-requirements";
import { REQUIREMENT_UPLOAD_LIMIT, REQUIREMENT_UPLOAD_TYPES } from "@/lib/requirement-policy";

export async function POST(request: Request) {
  try {
    const body = await request.json() as HandleUploadBody;
    const result = await handleUpload({ request, body,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        const { bookingId, questionId } = JSON.parse(clientPayload || "{}");
        if (typeof bookingId !== "string" || typeof questionId !== "string") throw new Error("Invalid booking.");
        await authorizeRequirementUpload(bookingId, questionId);
        const prefix = `booking-documents/${bookingId}/${questionId}/`;
        if (!pathname.startsWith(prefix) || !/^[a-zA-Z0-9._-]+$/.test(pathname.slice(prefix.length))) throw new Error("Invalid document path.");
        return { allowedContentTypes: REQUIREMENT_UPLOAD_TYPES, maximumSizeInBytes: REQUIREMENT_UPLOAD_LIMIT,
          validUntil: Date.now() + 10 * 60_000, addRandomSuffix: true, allowOverwrite: false };
      },
    });
    return Response.json(result);
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unable to upload document." }, { status: 400 });
  }
}
