import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const mapImage = "/worlds/valtherion/map-biomes-v1.jpg";

const world = await prisma.world.update({
  where: { id: "valtherion" },
  data: { mapImage },
});
console.log("updated", world.id, world.mapImage);
await prisma.$disconnect();
