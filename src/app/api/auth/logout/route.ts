import { jsonOk } from "@/lib/api";
import { revokeSession } from "@/lib/identity";
import { tokenFromRequest } from "@/lib/auth-token";

export async function POST(req: Request) {
  await revokeSession(tokenFromRequest(req));
  return jsonOk({ authenticated: false });
}
