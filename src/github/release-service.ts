import { Octokit } from "@octokit/rest";
import { components } from "@octokit/openapi-types"
import { ReleaseDto } from "../dto/release-dto";
import { ReleaseAssetDto } from "../dto/release-asset-dto";

export class ReleaseService {
    private readonly client: Octokit

    constructor(client: Octokit) {
        this.client = client;
    }

    async getReleasesForRepo(repository: string): Promise<ReleaseDto[]> {
        const authenticatedUser = await this.client.users.getAuthenticated();
        const owner = authenticatedUser.data.login;
        const releases = await this.client.repos.listReleases({
            owner: owner,
            repo: repository
        });
        if (releases.status != 200) {
            throw new Error(`Failed to get releases for ${owner}/${repository}`);
        }
        return releases.data.map(release => this.createRelease(repository, release));
    }

    private createRelease(repository: string, release: components["schemas"]["release"]): ReleaseDto {
        return {
            repoName: repository,
            description: release.body,
            version: release.tag_name,
            assets: release.assets.map(asset => this.createReleaseAsset(asset, release))
        } as ReleaseDto;
    }

    private createReleaseAsset(asset: components["schemas"]["release-asset"], release: components["schemas"]["release"]): ReleaseAssetDto {
        const [filename] = asset.name.split(".");
        const [, , platform, architecture] = filename.split("-");
        const url = new URL("/api/getUpdate");
        url.searchParams.append("version", release.tag_name);
        url.searchParams.append("platform", platform);
        url.searchParams.append("arch", architecture);
        return {
            platform: platform,
            arch: architecture,
            releaseDate: new Date(release.created_at),
            fileName: asset.name,
            contentLength: asset.size,
            url: url.toString()
        } as ReleaseAssetDto;
    }
}