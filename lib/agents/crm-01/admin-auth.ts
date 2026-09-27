export class CrmAdminAuthError extends Error {
  status: 401 | 403;
  constructor(status: 401 | 403, message: string) { super(message); this.name = "CrmAdminAuthError"; this.status = status; }
}

export async function authorizeCrmAdmin(request: Request, dependencies: { verifyIdToken(token: string): Promise<{ uid: string }>; loadUser(uid: string): Promise<{ exists: boolean; isAdmin: boolean }> }) {
  const authorization = request.headers.get("authorization") || "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
  if (!token) throw new CrmAdminAuthError(401, "Authentication required.");
  let decoded: { uid: string };
  try { decoded = await dependencies.verifyIdToken(token); } catch { throw new CrmAdminAuthError(401, "Authentication is invalid or expired."); }
  const user = await dependencies.loadUser(decoded.uid);
  if (!user.exists || user.isAdmin !== true) throw new CrmAdminAuthError(403, "Admin access required.");
  return { uid: decoded.uid };
}
