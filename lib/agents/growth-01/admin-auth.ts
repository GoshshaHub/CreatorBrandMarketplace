export type GrowthAdminAuthDependencies = {
  verifyIdToken(token: string): Promise<{ uid: string }>;
  loadUser(uid: string): Promise<{ exists: boolean; isAdmin: boolean }>;
};

export class GrowthAdminAuthError extends Error {
  status: 401 | 403;

  constructor(status: 401 | 403, message: string) {
    super(message);
    this.name = "GrowthAdminAuthError";
    this.status = status;
  }
}

export function getBearerToken(request: Request): string {
  const authorization = request.headers.get("authorization") || "";
  return authorization.startsWith("Bearer ") ? authorization.slice("Bearer ".length).trim() : "";
}

export async function authorizeGrowthAdmin(
  request: Request,
  dependencies: GrowthAdminAuthDependencies
): Promise<{ uid: string }> {
  const token = getBearerToken(request);
  if (!token) throw new GrowthAdminAuthError(401, "Authentication required.");

  let decoded: { uid: string };
  try {
    decoded = await dependencies.verifyIdToken(token);
  } catch {
    throw new GrowthAdminAuthError(401, "Authentication is invalid or expired.");
  }

  const user = await dependencies.loadUser(decoded.uid);
  if (!user.exists || user.isAdmin !== true) {
    throw new GrowthAdminAuthError(403, "Admin access required.");
  }

  return { uid: decoded.uid };
}
