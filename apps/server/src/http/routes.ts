import type { FastifyInstance } from "fastify";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@valtherion/db";
import { dnd2024 } from "@valtherion/rules-dnd2024";
import type { WorldBundleDto } from "@valtherion/contracts";
import { loadWorldSeed } from "../worldSeed.js";

async function getWorldBundle(id: string): Promise<WorldBundleDto | null> {
  try {
    const world = await prisma.world.findUnique({ where: { id } });
    if (world) {
      const [pins, loreNodes] = await Promise.all([
        prisma.pin.findMany({ where: { worldId: id } }),
        prisma.loreNode.findMany({ where: { worldId: id } }),
      ]);
      return {
        world: {
          id: world.id,
          name: world.name,
          description: world.description,
          width: world.width,
          height: world.height,
          mapImage: world.mapImage,
          rulePackId: world.rulePackId,
        },
        pins: pins.map((p) => ({
          id: p.id,
          kind: p.kind as WorldBundleDto["pins"][number]["kind"],
          label: p.label,
          x: p.x,
          y: p.y,
          minZoom: p.minZoom,
          maxZoom: p.maxZoom,
          loreNodeId: p.loreNodeId,
          color: p.color,
          importance: p.importance,
        })),
        loreNodes: loreNodes.map((n) => ({
          id: n.id,
          title: n.title,
          body: n.body,
          tags: n.tags,
          dmOnly: n.dmOnly,
        })),
      };
    }
  } catch {
    // DB offline → seed en disco
  }
  return loadWorldSeed(id);
}

export async function registerRoutes(app: FastifyInstance) {
  app.get("/health", async () => ({ ok: true, service: "valtherion-api" }));

  app.post("/auth/login", async (req, reply) => {
    const body = z
      .object({ username: z.string(), password: z.string() })
      .parse(req.body);
    try {
      const user = await prisma.user.findUnique({ where: { username: body.username } });
      if (!user || !(await bcrypt.compare(body.password, user.passwordHash))) {
        return reply.code(401).send({ error: "Credenciales inválidas" });
      }
      return {
        user: { id: user.id, username: user.username, displayName: user.displayName },
        token: `dev.${user.id}`,
      };
    } catch {
      return reply.code(503).send({ error: "Base de datos no disponible. Levantá Docker (pnpm db:up)." });
    }
  });

  app.get("/worlds/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const bundle = await getWorldBundle(id);
    if (!bundle) return reply.code(404).send({ error: "World not found" });
    return bundle;
  });

  app.get("/campaigns", async (_req, reply) => {
    try {
      const campaigns = await prisma.campaign.findMany({
        include: { world: true },
        orderBy: { createdAt: "desc" },
      });
      return campaigns.map((c) => ({
        id: c.id,
        name: c.name,
        description: c.description,
        worldId: c.worldId,
        rulePackId: c.rulePackId,
        worldName: c.world.name,
      }));
    } catch {
      return reply.code(503).send({
        error: "DB offline",
        hint: "pnpm db:up && pnpm db:push && pnpm db:seed",
      });
    }
  });

  app.get("/rules/:packId", async (req, reply) => {
    const { packId } = req.params as { packId: string };
    if (packId !== "dnd-2024") {
      return reply.code(404).send({ error: "Rule pack not found" });
    }
    return {
      meta: dnd2024.meta,
      compendium: dnd2024.listCompendium(),
    };
  });

  app.post("/rules/:packId/roll", async (req, reply) => {
    const { packId } = req.params as { packId: string };
    if (packId !== "dnd-2024") {
      return reply.code(404).send({ error: "Rule pack not found" });
    }
    const body = z
      .object({
        type: z.enum(["check", "initiative"]),
        modifier: z.number().default(0),
        proficient: z.boolean().optional(),
        proficiencyBonus: z.number().optional(),
        advantage: z.boolean().optional(),
        disadvantage: z.boolean().optional(),
      })
      .parse(req.body);

    if (body.type === "initiative") {
      return dnd2024.rollInitiative(body.modifier);
    }
    return dnd2024.rollAbilityCheck({
      modifier: body.modifier,
      proficient: body.proficient,
      proficiencyBonus: body.proficiencyBonus,
      advantage: body.advantage,
      disadvantage: body.disadvantage,
    });
  });
}
