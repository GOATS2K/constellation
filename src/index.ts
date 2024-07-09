import { Hono } from "hono";
import { validator } from "hono/validator";
import { jwt, verify } from "hono/jwt";
import {
  correctArchitecture,
  correctPlatformName,
  correctVersionNumber,
  validateEnvironmentVariable,
} from "./util";
import { z } from "zod";
import { ReleaseDto } from "./dto/release-dto";
import { GiteaAuthService } from "./gitea/gitea-auth-service";
import { giteaApi } from "gitea-js";
import { ReleaseService } from "./release-service-wrapper";
import { SignJWT } from "jose";
import { ReleaseAssetDownloadDto } from "./dto/release-asset-download";
import url from "node:url";

const authService = new GiteaAuthService();
const rs = new ReleaseService();

async function setDownloadUrlForAsset(
hostUrl: url.URL, releaseAsset: ReleaseAssetDownloadDto, repository: string,
) {
  const currentTime = Math.floor(Date.now() / 1000);
  const releaseSpecificJwt = new SignJWT({repository: repository, platform: releaseAsset.platform, version: releaseAsset.version, arch: releaseAsset.arch})
    .setAudience("Constellation")
    .setIssuer("Constellation Server")
    .setIssuedAt(currentTime)
    .setExpirationTime(currentTime + 1800)
    .setNotBefore(currentTime - 300)
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(releaseAsset.fileName);

  const token = await releaseSpecificJwt.sign(
    new TextEncoder().encode(validateEnvironmentVariable("JWT_SECRET_KEY")),
  );
  releaseAsset.url = `${hostUrl.protocol}//${hostUrl.host}${releaseAsset.url}?token=${encodeURIComponent(token)}`;
}

const app = new Hono();
app.use(
  "/versions/*",
  jwt({
    secret: validateEnvironmentVariable("JWT_SECRET_KEY"),
  }),
);
app.get("/gitea/auth", async (c) => {
  const giteaServer = validateEnvironmentVariable("GITEA_SERVER");
  const clientId = validateEnvironmentVariable("GITEA_CLIENT_ID");
  const callbackUri = validateEnvironmentVariable("GITEA_REDIRECT_URI");
  const giteaUrl = `${giteaServer}/login/oauth/authorize?client_id=${clientId}&redirect_uri=${callbackUri}&response_type=code&state=`;
  return c.redirect(giteaUrl);
});
app.get(
  "/gitea/callback",
  validator("query", (value, c) => {
    const schema = z.object({
      code: z.string(),
    });
    const parsedSchema = schema.safeParse(value);
    if (!parsedSchema.success) {
      return c.json(parsedSchema.error, 400);
    }
    return parsedSchema.data;
  }),
  async (c) => {
    const { code } = c.req.query();
    try {
      if (await authService.loadCredentials() != null) {
        return c.json(
          {
            error: true,
            message: "You have already logged in to Gitea.",
          },
          403,
        );
      }
      await authService.login(code);
      return c.json({
        message: "Successfully logged in to Gitea!"
      })
    } catch (error) {
      return c.json({
        error: true,
        message: "Failed to get token from Gitea",
        debug: JSON.parse((error as Error).message),
      });
    }
  },
);
app.get("/versions", async (c) => {
  const payload = c.get("jwtPayload");
  const releases = (await rs.getReleasesForRepo(
    payload.repository,
  )) as ReleaseDto[];
  const { includePrerelease } = c.req.query();
  if (includePrerelease == null) {
    return c.json(releases.filter((r) => !r.prerelease));
  }
  return c.json(releases);
});
app.get(
  "/download",
  validator("query", (value, c) => {
    const schema = z.object({
      token: z.string(),
    });
    const parsedSchema = schema.safeParse(value);
    if (!parsedSchema.success) {
      return c.json(parsedSchema.error, 400);
    }
    return parsedSchema.data;
  }),
  async (c) => {
    const { token } = c.req.valid("query");

    try {
      const decodedToken = await verify(
        decodeURIComponent(token),
        validateEnvironmentVariable("JWT_SECRET_KEY"),
      );
      const tokenPayload = decodedToken as Record<string, string>;
      const {repository, version, platform, arch} = tokenPayload;
      console.log(tokenPayload)

      const asset = await rs.getReleaseAssetStream(
        repository,
        correctVersionNumber(version),
        correctPlatformName(platform),
        correctArchitecture(arch),
      );

      return c.body(asset.stream, 200, {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename=\"${asset.fileName}\"`,
        "Content-Length": asset.size.toString(),
      });
    } catch (error) {
      const e = error as Error;
      return c.json(
        {
          error: true,
          message: e.message,
        },
        404,
      );
    }
  },
);
app.get(
  "/versions/:version",
  validator("query", (value, c) => {
    const schema = z.object({
      arch: z.string(),
      platform: z.string(),
    });
    const parsedSchema = schema.safeParse(value);
    if (!parsedSchema.success) {
      return c.json(parsedSchema.error, 400);
    }
    return parsedSchema.data;
  }),
  async (c) => {
    const payload = c.get("jwtPayload");
    const version = c.req.param("version");
    const { arch, platform } = c.req.valid("query");
    const userAgent = c.req.header("user-agent");
    const forwardedFor = c.req.header("X-Forwarded-For");

    console.log(
      `[${new Date().toISOString()}] [${forwardedFor}] User agent ${userAgent} requested version ${version} for ${platform}/${arch}`,
    );

    try {
      const release = await rs.getRelease(
        payload.repository,
        correctVersionNumber(version),
        correctPlatformName(platform),
        correctArchitecture(arch),
      );

      if (release.url.startsWith("/")) {
        const hostUrl = new URL(c.req.url);
        await setDownloadUrlForAsset(hostUrl, release, payload.repository);
      }
      return c.json(release);
    } catch (error) {
      const e = error as Error;
      return c.json(
        {
          error: true,
          message: e.message,
        },
        404,
      );
    }
  },
);

export default {
  port: 8000,
  fetch: app.fetch,
};
