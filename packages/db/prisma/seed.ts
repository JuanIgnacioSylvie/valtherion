import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const seedPath = path.resolve(__dirname, "../../../content/worlds/valtherion/seed.json");

async function main() {
  if (!fs.existsSync(seedPath)) {
    throw new Error(`Falta seed del mundo: ${seedPath}. Corré pnpm world:extract`);
  }
  const seed = JSON.parse(fs.readFileSync(seedPath, "utf8")) as {
    world: {
      id: string;
      name: string;
      description?: string;
      width: number;
      height: number;
      mapImage: string;
      rulePackId: string;
    };
    pins: Array<{
      id: string;
      kind: string;
      label: string;
      x: number;
      y: number;
      minZoom: number;
      maxZoom: number;
      loreNodeId: string | null;
      color?: string;
      importance: number;
    }>;
    loreNodes: Array<{
      id: string;
      title: string;
      body: string;
      tags: string[];
      dmOnly: boolean;
    }>;
  };

  const passwordHash = await bcrypt.hash("changeme", 10);

  const dm = await prisma.user.upsert({
    where: { username: "dm" },
    update: {},
    create: {
      username: "dm",
      displayName: "Dungeon Master",
      passwordHash,
    },
  });

  await prisma.user.upsert({
    where: { username: "jugador1" },
    update: {},
    create: {
      username: "jugador1",
      displayName: "Jugador 1",
      passwordHash,
    },
  });

  await prisma.pin.deleteMany({ where: { worldId: seed.world.id } });
  await prisma.loreNode.deleteMany({ where: { worldId: seed.world.id } });

  await prisma.world.upsert({
    where: { id: seed.world.id },
    update: {
      name: seed.world.name,
      description: seed.world.description ?? null,
      width: seed.world.width,
      height: seed.world.height,
      mapImage: seed.world.mapImage,
      rulePackId: seed.world.rulePackId,
    },
    create: {
      id: seed.world.id,
      name: seed.world.name,
      description: seed.world.description ?? null,
      width: seed.world.width,
      height: seed.world.height,
      mapImage: seed.world.mapImage,
      rulePackId: seed.world.rulePackId,
    },
  });

  await prisma.loreNode.createMany({
    data: seed.loreNodes.map((n) => ({
      id: n.id,
      worldId: seed.world.id,
      title: n.title,
      body: n.body,
      tags: n.tags ?? [],
      dmOnly: n.dmOnly ?? false,
    })),
  });

  await prisma.pin.createMany({
    data: seed.pins.map((p) => ({
      id: p.id,
      worldId: seed.world.id,
      kind: p.kind,
      label: p.label,
      x: p.x,
      y: p.y,
      minZoom: p.minZoom,
      maxZoom: p.maxZoom,
      loreNodeId: p.loreNodeId,
      color: p.color ?? null,
      importance: p.importance,
    })),
  });

  const existing = await prisma.campaign.findFirst({
    where: { worldId: seed.world.id, dmId: dm.id },
  });
  if (!existing) {
    await prisma.campaign.create({
      data: {
        name: "Crónicas de Valtherion",
        description: "Campaña inicial en el mundo tripartito.",
        worldId: seed.world.id,
        rulePackId: "dnd-2024",
        dmId: dm.id,
      },
    });
  }

  console.log(
    `Seed OK — world=${seed.world.id} pins=${seed.pins.length} lore=${seed.loreNodes.length}`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
