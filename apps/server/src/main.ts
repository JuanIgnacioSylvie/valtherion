import path from "node:path";
import { fileURLToPath } from "node:url";
import Fastify from "fastify";
import cors from "@fastify/cors";
import dotenv from "dotenv";
import { Server as SocketServer } from "socket.io";
import { registerRoutes } from "./http/routes.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

const port = Number(process.env.API_PORT || 4100);

async function main() {
  const app = Fastify({ logger: true });
  await app.register(cors, { origin: true });

  await registerRoutes(app);

  await app.listen({ port, host: "0.0.0.0" });

  const io = new SocketServer(app.server, {
    cors: { origin: true },
  });

  io.on("connection", (socket) => {
    socket.on("session:join", (campaignId: string) => {
      socket.join(`campaign:${campaignId}`);
    });
    socket.on("camera:update", (payload: unknown) => {
      const data = payload as { campaignId?: string };
      if (data?.campaignId) {
        socket.to(`campaign:${data.campaignId}`).emit("camera:update", payload);
      }
    });
  });

  app.log.info(`Valtherion API on :${port}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
