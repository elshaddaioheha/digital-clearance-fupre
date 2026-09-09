import { NextResponse } from "next/server";
import { Role, ClearanceStatus } from "@/lib/auth";
import { requireRole } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function GET(req: Request) {
  try {
    // 1. Require Admin or Registrar Role (Registrar is read-only)
    const { user, errorResponse } = await requireRole(req, [Role.ADMIN, Role.REGISTRAR]);
    if (errorResponse) return errorResponse;

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Parse query parameters
    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search") || "";
    const department = searchParams.get("department") || "";
    const session = searchParams.get("session") || "";
    const statusParam = searchParams.get("status") || ""; // "FULLY_CLEARED" or "PENDING"

    // 3. Build Prisma where clause
    const whereClause: any = {};

    if (department) {
      whereClause.department = { equals: department, mode: "insensitive" };
    }

    if (session) {
      whereClause.sessionOfGraduation = { equals: session, mode: "insensitive" };
    }

    if (search) {
      whereClause.OR = [
        { matricNumber: { contains: search, mode: "insensitive" } },
        {
          user: {
            name: { contains: search, mode: "insensitive" },
          },
        },
      ];
    }

    // 4. Fetch students and active units count
    const [students, totalActiveUnits] = await Promise.all([
      prisma.student.findMany({
        where: whereClause,
        include: {
          user: {
            select: {
              name: true,
              email: true,
              phone: true,
              createdAt: true,
            },
          },
          clearanceRequests: {
            include: {
              clearingUnit: true,
            },
            // Clearance order is the meaningful order for every consumer of
            // this payload: the registrar's CSV columns, the per-student
            // breakdown, and the admin progress view.
            orderBy: {
              clearingUnit: {
                sortOrder: "asc",
              },
            },
          },
        },
        orderBy: {
          matricNumber: "asc",
        },
      }),
      prisma.clearingUnit.count({
        where: { isActive: true },
      }),
    ]);

    // 5. Map and filter by overall status in memory
    let mappedStudents = students.map((s) => {
      const approvedCount = s.clearanceRequests.filter(
        (r) => r.status === ClearanceStatus.APPROVED && r.clearingUnit.isActive
      ).length;
      
      const isFullyCleared = totalActiveUnits > 0 && approvedCount === totalActiveUnits;

      return {
        userId: s.userId,
        matricNumber: s.matricNumber,
        department: s.department,
        faculty: s.faculty,
        level: s.level,
        sessionOfGraduation: s.sessionOfGraduation,
        user: {
          name: s.user.name,
          email: s.user.email,
          phone: s.user.phone,
        },
        isFullyCleared,
        clearanceRequests: s.clearanceRequests.map((r) => ({
          id: r.id,
          status: r.status,
          unitId: r.unitId,
          clearingUnit: {
            name: r.clearingUnit.name,
            sortOrder: r.clearingUnit.sortOrder,
          },
        })),
      };
    });

    if (statusParam === "FULLY_CLEARED") {
      mappedStudents = mappedStudents.filter((s) => s.isFullyCleared);
    } else if (statusParam === "PENDING") {
      mappedStudents = mappedStudents.filter((s) => !s.isFullyCleared);
    }

    return NextResponse.json({
      students: mappedStudents,
    });
  } catch (error) {
    console.error("Fetch admin students error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
