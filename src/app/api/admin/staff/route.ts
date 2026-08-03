import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { Role } from "@/lib/auth";
import { requireRole } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { createAuditLog } from "@/lib/audit";

const createStaffSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters long"),
  email: z.string().email("Invalid email format"),
  password: z.string().min(6, "Password must be at least 6 characters long"),
  phone: z.string().optional(),
  assignedUnitIds: z.array(z.string()).optional(),
});

// GET /api/admin/staff - List all staff
export async function GET(req: Request) {
  try {
    const { user, errorResponse } = await requireRole(req, [Role.ADMIN, Role.STAFF]);
    if (errorResponse) return errorResponse;

    const staffMembers = await prisma.staff.findMany({
      include: {
        user: {
          select: {
            name: true,
            email: true,
            phone: true,
            deletedAt: true,
          },
        },
        assignments: {
          include: {
            clearingUnit: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    return NextResponse.json({
      staff: staffMembers.map((s) => ({
        id: s.userId,
        name: s.user.name,
        email: s.user.email,
        phone: s.user.phone,
        deletedAt: s.user.deletedAt,
        assignments: s.assignments.map((a) => ({
          unitId: a.clearingUnit.id,
          unitName: a.clearingUnit.name,
        })),
      })),
    });
  } catch (error) {
    console.error("Fetch staff error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST /api/admin/staff - Create new staff account
export async function POST(req: Request) {
  try {
    const { user, errorResponse } = await requireRole(req, [Role.ADMIN]);
    if (errorResponse) return errorResponse;

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = createStaffSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const { name, email, password, phone, assignedUnitIds } = parsed.data;

    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "Email is already registered" },
        { status: 400 }
      );
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const newStaff = await prisma.$transaction(async (tx) => {
      const userRecord = await tx.user.create({
        data: {
          email,
          hashedPassword,
          name,
          role: Role.STAFF,
          phone,
        },
      });

      const staffRecord = await tx.staff.create({
        data: {
          userId: userRecord.id,
        },
      });

      if (assignedUnitIds && assignedUnitIds.length > 0) {
        await tx.staffUnitAssignment.createMany({
          data: assignedUnitIds.map((unitId) => ({
            staffId: userRecord.id,
            unitId,
          })),
        });
      }

      return { user: userRecord, staff: staffRecord };
    });

    await createAuditLog({
      actorId: user.userId,
      actorRole: Role.ADMIN,
      action: "CREATE_STAFF_ACCOUNT",
      entityType: "User",
      entityId: newStaff.user.id,
      metadata: {
        email: newStaff.user.email,
        assignedUnitCount: assignedUnitIds?.length || 0,
      },
    });

    return NextResponse.json(
      {
        message: "Staff account created successfully.",
        staff: {
          id: newStaff.user.id,
          name: newStaff.user.name,
          email: newStaff.user.email,
          role: newStaff.user.role,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Create staff error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
