import { NextResponse } from "next/server";
import { verifyAccessToken, TokenPayload } from "./jwt";
import prisma from "./prisma";

export enum Role {
  STUDENT = "STUDENT",
  STAFF = "STAFF",
  ADMIN = "ADMIN",
  REGISTRAR = "REGISTRAR",
}

export enum ClearanceStatus {
  NOT_SUBMITTED = "NOT_SUBMITTED",
  PENDING_REVIEW = "PENDING_REVIEW",
  UNDER_REVIEW = "UNDER_REVIEW",
  APPROVED = "APPROVED",
  REJECTED = "REJECTED",
}

export interface AuthenticatedUser extends TokenPayload {}

/**
 * Extracts and verifies the access token from the request headers.
 * Returns the authenticated user or an error response.
 */
export async function verifyAuth(req: Request): Promise<{
  user: AuthenticatedUser | null;
  errorResponse: NextResponse | null;
}> {
  let token: string | null = null;

  const authHeader = req.headers.get("authorization");
  if (authHeader && authHeader.startsWith("Bearer ")) {
    token = authHeader.split(" ")[1];
  } else {
    try {
      const url = new URL(req.url);
      token = url.searchParams.get("token");
    } catch (e) {}
  }

  if (!token) {
    return {
      user: null,
      errorResponse: NextResponse.json(
        { error: "Unauthorized: Missing or invalid token format." },
        { status: 401 }
      ),
    };
  }

  const payload = await verifyAccessToken(token);

  if (!payload) {
    return {
      user: null,
      errorResponse: NextResponse.json(
        { error: "Unauthorized: Token is expired or invalid." },
        { status: 401 }
      ),
    };
  }

  // Double check if the user is active (not soft deleted)
  const dbUser = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: { deletedAt: true },
  });

  if (!dbUser || dbUser.deletedAt !== null) {
    return {
      user: null,
      errorResponse: NextResponse.json(
        { error: "Unauthorized: User account is inactive or deleted." },
        { status: 401 }
      ),
    };
  }

  return {
    user: payload,
    errorResponse: null,
  };
}

/**
 * Ensures the authenticated user has one of the allowed roles.
 */
export async function requireRole(
  req: Request,
  allowedRoles: Role[]
): Promise<{
  user: AuthenticatedUser | null;
  errorResponse: NextResponse | null;
}> {
  const { user, errorResponse } = await verifyAuth(req);
  if (errorResponse) {
    return { user: null, errorResponse };
  }

  if (!user || !allowedRoles.includes(user.role as Role)) {
    return {
      user: null,
      errorResponse: NextResponse.json(
        { error: "Forbidden: You do not have permission to access this resource." },
        { status: 403 }
      ),
    };
  }

  return { user, errorResponse: null };
}

/**
 * Ensures the user is a staff member and is assigned to the specified clearing unit.
 */
export async function requireUnitAccess(
  req: Request,
  unitId: string
): Promise<{
  user: AuthenticatedUser | null;
  errorResponse: NextResponse | null;
}> {
  const { user, errorResponse } = await requireRole(req, [Role.STAFF, Role.ADMIN]);
  if (errorResponse) {
    return { user: null, errorResponse };
  }

  if (!user) {
    return {
      user: null,
      errorResponse: NextResponse.json({ error: "Unauthorized." }, { status: 401 }),
    };
  }

  // Admins bypass unit checks
  if (user.role === Role.ADMIN) {
    return { user, errorResponse: null };
  }

  // Check assignment
  const assignment = await prisma.staffUnitAssignment.findUnique({
    where: {
      staffId_unitId: {
        staffId: user.userId,
        unitId: unitId,
      },
    },
  });

  if (!assignment) {
    return {
      user: null,
      errorResponse: NextResponse.json(
        { error: "Forbidden: You are not assigned to manage this clearing unit." },
        { status: 403 }
      ),
    };
  }

  return { user, errorResponse: null };
}
