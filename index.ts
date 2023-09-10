import { Octokit } from "@octokit/rest";
import { Elysia, t } from "elysia";
import { jwt, JWTPayloadSpec } from "@elysiajs/jwt";
import { bearer } from "@elysiajs/bearer";
import { ReleaseService } from "./src/github/release-service";
import { RequestError } from "@octokit/request-error";
import { ApiError } from "./src/dto/api-error";
import {
  validateEnvironmentVariable,
  correctPlatformName,
  correctArchitecture,
  correctVersionNumber,
} from "./src/util";

const githubToken = validateEnvironmentVariable("GITHUB_TOKEN");
const jwtSecretKey = validateEnvironmentVariable("JWT_SECRET_KEY");

const octokit = new Octokit({
  auth: githubToken,
});
const releaseService = new ReleaseService(octokit);

const app = new Elysia()
  .use(
    jwt({
      secret: jwtSecretKey,
      iss: "Constellation",
      aud: "ConstellationServer",
    })
  )
  .use(bearer())
  .onError(({ error }) => {
    return new Response(error.toString(), {
      status: 500,
    });
  })
  .on("beforeHandle", ({ bearer, set }) => {
    if (!bearer) {
      set.status = 400;
      set.headers[
        "WWW-Authenticate"
      ] = `Bearer realm='sign', error="invalid_request"`;

      return "Unauthorized";
    }
  })
  .decorate("getRepository", async ({ jwt, bearer }): Promise<string> => {
    const validatedToken = await jwt.verify(bearer as string);
    if (!validatedToken) {
      return "";
    }
    const payload = validatedToken as Record<string, string> & JWTPayloadSpec;
    return payload.repository;
  })
  .get("/versions", async ({ set, getRepository, jwt, bearer }) => {
    const repository = await getRepository({ jwt, bearer });
    if (repository == "") {
      set.status = 401;
      return;
    }
    const releases = await releaseService.getReleasesForRepo(repository);
    if (releases instanceof RequestError) {
      set.status = releases.status;
      return {
        message: `Failed to get releases for repo: ${repository}`,
        originMessage: releases.message,
        originStatus: releases.status,
      } as ApiError;
    }
    return releases;
  })
  .get(
    "/versions/:version",
    async ({ params: { version }, query, getRepository, set, jwt, bearer }) => {
      const repository = await getRepository({ jwt, bearer });
      if (repository == "") {
        set.status = 401;
        return;
      }
      const platform = correctPlatformName(query.platform);
      const arch = correctArchitecture(query.arch);

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
  )
  .listen(8000);

console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`
);
