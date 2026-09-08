import { NextResponse } from "next/server";
import { Role, requireRole } from "@/lib/auth";
import prisma from "@/lib/prisma";

/**
 * Returns the signed-in staff member's own profile and unit assignments.
 *
 * The staff dashboard used to read the full /api/admin/staff directory just to
 * locate its own row, which exposed every colleague's name, email and phone to
 * any staff account. This returns only the caller's record.
 */
export async function GET(req: Request) {
  try {
    const { user, errorResponse } = await requireRole(req, [Role.STAFF, Role.ADMIN]);
    if (errorResponse) return errorResponse;

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const staff = await prisma.staff.findUnique({
      where: { userId: user.userId },
      include: {
        user: {
          select: {
            name: true,
            email: true,
            phone: true,
          },
        },
        assignments: {
          include: {
            clearingUnit: {
              select: {
                id: true,
                name: true,
                description: true,
                sortOrder: true,
                isActive: true,
              },
            },
          },
          orderBy: {
            clearingUnit: {
              sortOrder: "asc",
            },
          },
        },
      },
    });

    if (!staff) {
      return NextResponse.json(
        { error: "No staff profile is associated with this account." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      id: staff.userId,
      name: staff.user.name,
      email: staff.user.email,
      phone: staff.user.phone,
      assignments: staff.assignments.map((a) => ({
        unitId: a.clearingUnit.id,
        unitName: a.clearingUnit.name,
        description: a.clearingUnit.description,
        sortOrder: a.clearingUnit.sortOrder,
        isActive: a.clearingUnit.isActive,
      })),
    });
  } catch (error) {
    console.error("Fetch staff profile error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
