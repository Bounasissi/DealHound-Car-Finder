import { jsonError, jsonOk, withApi } from "@/lib/api";
import { currentAuthContext, currentUserId } from "@/lib/auth";
import { deleteUserAccount } from "@/lib/identity";

export const GET = withApi("account.get", async () => jsonOk({ user: currentAuthContext() }));

export const DELETE = withApi("account.delete", async () => {
  if (!currentAuthContext().email) return jsonError(409, "Legacy token accounts must be migrated before deletion");
  await deleteUserAccount(currentUserId());
  return jsonOk({ deleted: true });
});
