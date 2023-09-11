import Elysia, { t } from "elysia";
import { setup } from "../../setup";
import { RequestError } from "@octokit/request-error";
import { ApiError } from "../../dto/api-error";
import {
  correctPlatformName,
  correctArchitecture,
  correctVersionNumber,
} from "../../util";

export const singleVersion = new Elysia().use(setup).get(
  "/versions/:version",
  async ({
    params: { version },
    query,
    getRepository,
    set,
    jwt,
    bearer,
    factory,
  }) => {
    const repository = await getRepository({ jwt, bearer });
    if (repository == "") {
      set.status = 401;
      return;
    }
    const platform = correctPlatformName(query.platform);
    const arch = correctArchitecture(query.arch);

    const releaseService = factory().getReleaseService();
    const release = await releaseService.getRelease(
      repository,
      correctVersionNumber(version),
      platform,
      arch
    );

    if (release instanceof RequestError) {
      set.status = release.status;
      return {
        message: `Failed to get version for repo: ${repository}`,
        originMessage: release.message,
        originStatus: release.status,
      } as ApiError;
    }
    return release;
  },
  {
    query: t.Object({
      arch: t.String(),
      platform: t.String(),
    }),
  }
);
