import Elysia from "elysia";
import { allVersions } from "./all";
import { singleVersion } from "./singleVersion";
import { setup } from "../../setup";

export const versionsController = new Elysia()
  .use(setup)
  .use(allVersions)
  .use(singleVersion);
