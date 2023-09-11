import { Octokit } from "@octokit/rest";
import { Elysia } from "elysia";
import { bearer } from "@elysiajs/bearer";
import { jwt, JWTPayloadSpec } from "@elysiajs/jwt";
import { ReleaseService } from "./github/release-service";
import { validateEnvironmentVariable } from "./util";
import { Factory } from "./factory";

const jwtSecretKey = validateEnvironmentVariable("JWT_SECRET_KEY");
const factory = new Factory();

export const setup = new Elysia({ name: "setup" })
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
  .decorate("factory", (): Factory => factory)
  .decorate("getRepository", async ({ jwt, bearer }): Promise<string> => {
    const validatedToken = await jwt.verify(bearer as string);
    if (!validatedToken) {
      return "";
    }
    const payload = validatedToken as Record<string, string> & JWTPayloadSpec;
    return payload.repository;
  });
