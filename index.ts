import { Octokit } from '@octokit/rest';
import { Elysia } from 'elysia';
import { ReleaseService } from './src/github/release-service';
import process from 'process';
import { ReleaseAssetDto } from './src/dto/release-asset-dto';
import { ReleaseDto } from './src/dto/release-dto';

const octokit = new Octokit({
    auth: process.env.GITHUB_TOKEN
});

const app = new Elysia()
    .onError(({ error }) => {
        return new Response(error.toString())
    })
    .get("/", () => "Hello world!")
    .get("/releases", async (): Promise<ReleaseDto[]> => {
        const releaseService = new ReleaseService(octokit);
        return await releaseService.getReleasesForRepo("Hydrogen");
    })
    .listen(8000);

console.log(`🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`)
