import { Octokit } from "@octokit/rest";
import { components } from "@octokit/openapi-types";
import { RequestError } from "@octokit/request-error";
import { ReleaseDto } from "../dto/release-dto";
import { ReleaseAssetDto } from "../dto/release-asset-dto";
import * as path from "path";
import { ReleaseAssetDownloadDto } from "../dto/release-asset-download";
import { IReleaseService } from "../irelease-service";
import { ReleaseStream } from "../dto/release-stream";

export class GithubReleaseService implements IReleaseService {
  private readonly client: Octokit;

  constructor(client: Octokit) {
    this.client = client;
  }
  async getReleaseAssetStream(
    repository: string,
    version: string,
    platform: string,
    arch: string,
  ): Promise<ReleaseStream> {
    const release = await this.getRelease(repository, version, platform, arch);
    const response = await fetch(release.url);
    return {
      fileName: release.fileName,
      size: release.size,
      stream: response.body,
    } as ReleaseStream;
  }

  async getAssetsForVersion(
    owner: string,
    repository: string,
    version: string,
  ): Promise<ReleaseAssetDto[] | RequestError> {
    try {
      if (version !== "latest") {
        return await this.getAssetsForTag(owner, repository, version);
      }
      const release = await this.client.repos.getLatestRelease({
        owner: owner,
        repo: repository,
      });
      return release.data.assets.map((a) => this.createReleaseAsset(a));
    } catch (error) {
      return error as RequestError;
    }
  }

  async getRelease(
    repository: string,
    version: string,
    platform: string,
    arch: string,
  ): Promise<ReleaseAssetDownloadDto> {
    const authenticatedUser = await this.client.users.getAuthenticated();
    const owner = authenticatedUser.data.login;
    let assets = await this.getAssetsForVersion(owner, repository, version);
    if (assets instanceof RequestError) {
      throw new Error(
        `Unable to fetch releases from GitHub: ${assets.message}`,
      );
    }
    assets = assets as ReleaseAssetDto[];
    const asset = assets.find(
      (a) => a.arch === arch && a.platform === platform,
    );
    if (asset == null) {
      throw new Error(`Cannot find asset.`);
    }

    const urlResponse = await this.client.repos.getReleaseAsset({
      owner: owner,
      repo: repository,
      asset_id: asset!.id,
      headers: {
        accept: "application/octet-stream",
      },
    });
    return {
      url: urlResponse.url,
      arch: asset.arch,
      platform: asset.platform,
      version: asset.version,
      fileName: asset.fileName,
      size: asset.contentLength,
    } as ReleaseAssetDownloadDto;
  }

  async getAssetsForTag(owner: string, repository: string, version: string) {
    const release = await this.client.repos.getReleaseByTag({
      owner: owner,
      repo: repository,
      tag: version,
    });

    if (release.status != 200) {
      throw new Error("Could not find release with requested version.");
    }

    const assets = release.data.assets.map((asset) =>
      this.createReleaseAsset(asset),
    );
    return assets;
  }

  async getReleasesForRepo(repository: string): Promise<ReleaseDto[]> {
    const authenticatedUser = await this.client.users.getAuthenticated();
    const owner = authenticatedUser.data.login;
    try {
      const releases = await this.client.repos.listReleases({
        owner: owner,
        repo: repository,
      });
      return releases.data.map((release) =>
        this.createRelease(repository, release),
      );
    } catch (error) {
      const reqError = error as RequestError;
      throw new Error(
        `Unable to fetch releases from GitHub: ${reqError.message}`,
      );
    }
  }

  private createRelease(
    repository: string,
    release: components["schemas"]["release"],
  ): ReleaseDto {
    return {
      repoName: repository,
      description: release.body,
      version: release.tag_name,
      assets: release.assets.map((asset) => this.createReleaseAsset(asset)),
      prerelease: release.prerelease,
    } as ReleaseDto;
  }

  private createReleaseAsset(
    asset: components["schemas"]["release-asset"],
  ): ReleaseAssetDto {
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
