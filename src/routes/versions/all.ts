import Elysia from "elysia";
import { setup } from "../../setup";
import { RequestError } from "@octokit/request-error";
import { ApiError } from "../../dto/api-error";

export const allVersions = new Elysia()
  .use(setup)
  .get("/versions", async ({ set, getRepository, jwt, bearer, factory }) => {
    const repository = await getRepository({ jwt, bearer });
    if (repository == "") {
      set.status = 401;
      return;
    }
    const releases = await factory()
      .getReleaseService()
      .getReleasesForRepo(repository);
    if (releases instanceof RequestError) {
      set.status = releases.status;
      return {
        message: `Failed to get releases for repo: ${repository}`,
        originMessage: releases.message,
        originStatus: releases.status,
      } as ApiError;
    }
    return releases;
  });
