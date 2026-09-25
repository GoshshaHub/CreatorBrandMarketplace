export type SalesAdminAuthDependencies = {
  verifyIdToken(token: string): Promise<{ uid: string }>;
  loadUser(uid: string): Promise<{ exists: boolean; isAdmin: boolean }>;
};

export class SalesAdminAuthError extends Error {
  status: 401 | 403;

  constructor(status: 401 | 403, message: string) {
    super(message);
    this.name = "SalesAdminAuthError";
    this.status = status;
  }
}

export async function authorizeSalesAdmin(request: Request, dependencies: SalesAdminAuthDependencies): Promise<{ uid: string }> {
  const authorization = request.headers.get("authorization") || "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice("Bearer ".length).trim() : "";
  if (!token) throw new SalesAdminAuthError(401, "Authentication required.");
  let decoded: { uid: string };
  try {
    decoded = await dependencies.verifyIdToken(token);
  } catch {
    throw new SalesAdminAuthError(401, "Authentication is invalid or expired.");
  }
  const user = await dependencies.loadUser(decoded.uid);
  if (!user.exists || user.isAdmin !== true) throw new SalesAdminAuthError(403, "Admin access required.");
  return { uid: decoded.uid };
}
