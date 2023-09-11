import Elysia from "elysia";
import { versionsController } from "./routes/versions";

const app = new Elysia().use(versionsController).listen(8000);

console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`
);
