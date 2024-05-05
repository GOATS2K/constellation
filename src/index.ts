import { Hono } from 'hono'
import { validator } from 'hono/validator'
import { jwt } from 'hono/jwt'
import { ReleaseService } from './github/release-service';
import { Octokit } from '@octokit/rest';
import { correctArchitecture, correctPlatformName, correctVersionNumber, validateEnvironmentVariable } from './util';
import { z } from 'zod'
import { ReleaseDto } from './dto/release-dto';

const rs = new ReleaseService(new Octokit({ auth: validateEnvironmentVariable("GITHUB_TOKEN") }));
const app = new Hono();
app.use('*', jwt({
    secret: validateEnvironmentVariable("JWT_SECRET_KEY"),
}))
app.get("/versions",
    async (c) => {
        const payload = c.get("jwtPayload")
        const releases = await rs.getReleasesForRepo(payload.repository) as ReleaseDto[]
        const { includePrerelease } = c.req.query();
        if (includePrerelease == null) {
            return c.json(releases.filter(r => !r.prerelease))
        }
        return c.json(releases)
    })
app.get("/versions/:version",
    validator("query", (value, c) => {
        const schema = z.object({
            arch: z.string(),
            platform: z.string()
        });
        const parsedSchema = schema.safeParse(value);
        if (!parsedSchema.success) {
            return c.json(parsedSchema.error, 400);
        }
        return parsedSchema.data;
    }),
    async (c) => {
        const payload = c.get("jwtPayload")
        const version = c.req.param("version")
        const { arch, platform } = c.req.valid("query");

        const releases = await rs.getRelease(payload.repository,
            correctVersionNumber(version),
            correctPlatformName(platform),
            correctArchitecture(arch))

        return c.json(releases)
    })


export default {
    port: 8000,
    fetch: app.fetch
}