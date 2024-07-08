import { Hono } from "hono";
import { validator } from "hono/validator";
import { jwt, decode, sign, verify } from "hono/jwt";
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

const authService = new GiteaAuthService();
const rs = new ReleaseService();
rs.getActiveService();

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
      // TODO: Return 403 if we've already got credentials
      const credentials = await authService.getCredentials(code);
      return c.json(credentials);
    } catch (error) {
      return c.json({
        error: true,
        message: "Failed to get token from Gitea",
        debug: JSON.parse((error as Error).message),
      });
    }
  },
);
app.get("/gitea/user", async (c) => {
  const giteaServer = validateEnvironmentVariable("GITEA_SERVER");
  const client = giteaApi(giteaServer, {
    token: await authService.getAccessToken(),
  });
  const user = await client.user.userCurrentListRepos();
  return c.json(user);
});
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
app.get("/download/:version",
  validator("query", (value, c) => {
    const schema = z.object({
      arch: z.string(),
      platform: z.string(),
      token: z.string()
    });
    const parsedSchema = schema.safeParse(value);
    if (!parsedSchema.success) {
      return c.json(parsedSchema.error, 400);
    }
    return parsedSchema.data;
  }), async (c) => {
    const { arch, platform, token } = c.req.valid("query");

    try {
      const decodedToken = await verify(decodeURIComponent(token), validateEnvironmentVariable("JWT_SECRET_KEY"));
      const tokenPayload = decodedToken as Record<string, string>
      const version = c.req.param("version");

      const asset = await rs.getReleaseAssetStream(tokenPayload["repository"],
        correctVersionNumber(version),
        correctPlatformName(platform),
        correctArchitecture(arch));
      
      return c.body(asset.stream, 200, {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename=\"${asset.fileName}\"`,
        "Content-Length": asset.size.toString()
      })
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
  }
)
app.get(
  "/versions/:version",
  validator("query", (value, c) => {
    const schema = z.object({
      arch: z.string(),
      platform: z.string(),
      download: z.optional(z.literal("true"))
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
    const { arch, platform, download } = c.req.valid("query");
    const userAgent = c.req.header("user-agent");
    const forwardedFor = c.req.header("X-Forwarded-For");

    const authHeader = c.req.header("Authorization");
    const token = authHeader!.replace("Bearer ", "");
    const hostUrl = new URL(c.req.url);

    console.log(
      `[${new Date().toISOString()}] [${forwardedFor}] User agent ${userAgent} requested version ${version} for ${platform}/${arch}`,
    );

    try {
      const releases = await rs.getRelease(
        payload.repository,
        correctVersionNumber(version),
        correctPlatformName(platform),
        correctArchitecture(arch),
      );

      if (releases.url.startsWith("/"))
        releases.url = `${hostUrl.protocol}//${hostUrl.host}${releases.url}&token=${encodeURIComponent(token)}`

      if (!download)
        return c.json(releases);

      const asset = await rs.getReleaseAssetStream(payload.repository,
        correctVersionNumber(version),
        correctPlatformName(platform),
        correctArchitecture(arch));
      
      return c.body(asset.stream, 200, {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename=\"${asset.fileName}\"`,
        "Content-Length": asset.size.toString()
      })
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
