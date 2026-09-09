import { NextResponse } from "next/server";
import { z } from "zod";
import { Role, requireRole } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { createAuditLog } from "@/lib/audit";

const updateUnitSchema = z
  .object({
    name: z.string().min(2, "Unit name must be at least 2 characters long").optional(),
    description: z.string().optional(),
    sortOrder: z.number().int().positive().optional(),
    isActive: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "Provide at least one field to update.",
  });

// PATCH /api/admin/units/[unitId]
export async function PATCH(
  req: Request,
  props: { params: Promise<{ unitId: string }> }
) {
  try {
    const { unitId } = await props.params;

    const { user, errorResponse } = await requireRole(req, [Role.ADMIN]);
    if (errorResponse) return errorResponse;

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = updateUnitSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const unit = await prisma.clearingUnit.findUnique({ where: { id: unitId } });
    if (!unit) {
      return NextResponse.json({ error: "Clearing unit not found." }, { status: 404 });
    }

    const { name, description, sortOrder, isActive } = parsed.data;

    // Names are unique, so reject a collision with a clear message rather than
    // letting the constraint surface as a 500.
    if (name && name !== unit.name) {
      const clash = await prisma.clearingUnit.findUnique({ where: { name } });
      if (clash) {
        return NextResponse.json(
          { error: "A clearing unit with this name already exists." },
          { status: 400 }
        );
      }
    }

    const updated = await prisma.clearingUnit.update({
      where: { id: unitId },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(description !== undefined ? { description } : {}),
        ...(sortOrder !== undefined ? { sortOrder } : {}),
        ...(isActive !== undefined ? { isActive } : {}),
      },
    });

    await createAuditLog({
      actorId: user.userId,
      actorRole: Role.ADMIN,
      action: isActive === false ? "DEACTIVATE_CLEARING_UNIT" : "UPDATE_CLEARING_UNIT",
      entityType: "ClearingUnit",
      entityId: updated.id,
      metadata: {
        name: updated.name,
        changed: Object.keys(parsed.data),
        previous: {
          name: unit.name,
          sortOrder: unit.sortOrder,
          isActive: unit.isActive,
        },
      },
    });

    return NextResponse.json({
      message: "Clearing unit updated successfully.",
      unit: updated,
    });
  } catch (error) {
    console.error("Update clearing unit error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
