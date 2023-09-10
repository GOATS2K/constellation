import { Octokit, RestEndpointMethodTypes } from "@octokit/rest";
import { components } from "@octokit/openapi-types"
import { ReleaseDto } from "../dto/release-dto";
import { ReleaseAssetDto } from "../dto/release-asset-dto";
import * as path from "path";
import { URL } from 'node:url';
import { ReleaseAssetDownloadDto } from "../dto/release-asset-download";

export class ReleaseService {
    private readonly client: Octokit

    constructor(client: Octokit) {
        this.client = client;
    }

    async getAssetsForVersion(owner: string, repository: string, version: string): Promise<ReleaseAssetDto[]> {
        if (version !== "latest") {
            return await this.getAssetsForTag(owner, repository, version);
        }
        const release = await this.client.repos.getLatestRelease({
            owner: owner,
            repo: repository
        })
        return release.data.assets.map(a => this.createReleaseAsset(a));
    }

    async getRelease(repository: string, version: string, platform: string, arch: string): Promise<ReleaseAssetDownloadDto> {
        const authenticatedUser = await this.client.users.getAuthenticated();
        const owner = authenticatedUser.data.login;
        const assets = await this.getAssetsForVersion(owner, repository, version);
        const asset = assets.find(a => a.arch === arch && a.platform === platform);
        if (asset == null) {
            throw new Error(`Cannot find asset.`);
        }

        const urlResponse = await this.client.repos.getReleaseAsset({
            owner: owner,
            repo: repository,
            asset_id: asset!.id,
            headers: {
                accept: "application/octet-stream"
            }
        });
        return {
            url: urlResponse.url,
            arch: asset.arch,
            platform: asset.platform,
            version: asset.version,
            fileName: asset.fileName,
            size: asset.contentLength
        } as ReleaseAssetDownloadDto
    }

    async getAssetsForTag(owner: string, repository: string, version: string) {
        const release = await this.client.repos.getReleaseByTag({
            owner: owner,
            repo: repository,
            tag: version
        });

        if (release.status != 200) {
            throw new Error("Could not find release with requested version.");
        }

        const assets = release.data.assets.map(asset => this.createReleaseAsset(asset));
        return assets;
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
            assets: release.assets.map(asset => this.createReleaseAsset(asset))
        } as ReleaseDto;
    }

    private createReleaseAsset(asset: components["schemas"]["release-asset"]): ReleaseAssetDto {
        const filename = path.basename(asset.name, ".zip");
        const [, version, platform, architecture] = filename.split("-");
        return {
            id: asset.id,
            version: version,
            platform: platform,
            arch: architecture,
            releaseDate: new Date(asset.created_at),
            fileName: asset.name,
            contentLength: asset.size,
        } as ReleaseAssetDto;
    }
}