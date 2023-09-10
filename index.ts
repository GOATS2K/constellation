import { Octokit } from '@octokit/rest';
import { Elysia, t } from 'elysia';
import { ReleaseService } from './src/github/release-service';
import process from 'process';
import { ReleaseDto } from './src/dto/release-dto';
import {correctPlatformName, correctArchitecture, correctVersionNumber } from "./src/util"

const octokit = new Octokit({
    auth: process.env.GITHUB_TOKEN
});
const releaseService = new ReleaseService(octokit);

const app = new Elysia()
    .onError(({ error }) => {
        return new Response(error.toString())
    })
    .get("/", () => "Hello world!")
    .get("/releases/:repository", async ({params, query}) => {
        const platform = correctPlatformName(query.platform);
        const arch = correctArchitecture(query.arch);
        const version = correctVersionNumber(query.version);

        return await releaseService.getRelease(params.repository, version, platform, arch);
    }, {
        query: t.Object({
            arch: t.String(),
            platform: t.String(),
            version: t.String()
        })
    })
    .get("/releases", async (): Promise<ReleaseDto[]> => {
        return await releaseService.getReleasesForRepo("Hydrogen");
    })
    .listen(8000);

console.log(`🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`)
