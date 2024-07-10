import { ReleaseAssetDto } from "../dto/release-asset-dto";
import { Api, giteaApi, Release, Attachment } from "gitea-js";
import { GiteaAuthService } from "./gitea-auth-service";
import { validateEnvironmentVariable } from "../util";
import { ReleaseDto } from "../dto/release-dto";
import path from "path";
import { IReleaseService } from "../irelease-service";
import { ReleaseAssetDownloadDto } from "../dto/release-asset-download";
import { ReleaseStream } from "../dto/release-stream";

interface SecurityDataType {
  token: string;
}

export class GiteaReleaseService implements IReleaseService {
  private authTokenService: GiteaAuthService;

  constructor(authService: GiteaAuthService) {
    this.authTokenService = authService;
  }

  async getReleaseAssetStream(
    repository: string,
    version: string,
    platform: string,
    arch: string,
  ): Promise<ReleaseStream> {
    // This can be optimized to get the attachement directly
    // rather than going the roundabout way of re-getting the repo and then the attachment.
    const { targetAsset, assetData } = await this.getGiteaAsset(
      repository,
      version,
      arch,
      platform,
    );
    const url = assetData.browser_download_url;
    if (url == null)
      throw new Error("Download URL from Gitea came back as null.");

    const accessToken = await this.authTokenService.getAccessToken();
    const response = await fetch(url.toString(), {
      headers: {
        Authorization: `token ${accessToken}`,
      },
    });
    if (!response.ok)
      throw new Error(`Failed to get stream: ${await response.text()}`);

    return {
      fileName: targetAsset.fileName,
      size: targetAsset.contentLength,
      stream: response.body,
    } as ReleaseStream;
  }

  async createApiClient(): Promise<Api<SecurityDataType>> {
    const token = await this.authTokenService.getAccessToken();
    const serverUrl = validateEnvironmentVariable("GITEA_SERVER");
    return giteaApi(serverUrl, {
      token: token,
    });
  }

  async getReleasesForRepo(repository: string): Promise<ReleaseDto[]> {
    const client = await this.createApiClient();
    const repoListResponse = await client.user.userCurrentListRepos();
    const repos = repoListResponse.data;
    const targetRepo = repos.find((t) => t.name === repository);
    if (targetRepo == null) {
      throw new Error(`Cannot find repository ${repository}.`);
    }

    const owner = targetRepo.owner?.login!;
    const releasesResponse = await client.repos.repoListReleases(
      owner,
      repository,
    );
    const releaseList = releasesResponse.data;
    return releaseList.map((r) => this.createRelease(r, repository, owner));
  }

  async getRelease(
    repository: string,
    version: string,
    platform: string,
    arch: string,
  ): Promise<ReleaseAssetDownloadDto> {
    const { targetAsset } = await this.getGiteaAsset(
      repository,
      version,
      arch,
      platform,
    );

    return {
      arch: arch,
      fileName: targetAsset.fileName,
      size: targetAsset.contentLength,
      platform: targetAsset.platform,
      url: `/download`,
      version: version,
    } as ReleaseAssetDownloadDto;
  }

  private async getGiteaAsset(
    repository: string,
    version: string,
    arch: string,
    platform: string,
  ) {
    const client = await this.createApiClient();
    const releases = await this.getReleasesForRepo(repository);
    const targetRelease = releases.find((r) => r.version === version);
    if (targetRelease == null) {
      console.error("Cannot find release.");
      throw new Error("Cannot find release.");
    }

    const targetAsset = targetRelease.assets.find(
      (r) => r.arch == arch && r.platform == platform,
    );
    if (targetAsset == null) throw new Error("Cannot find asset.");

    const asset = await client.repos.repoGetReleaseAttachment(
      targetRelease.owner,
      repository,
      targetRelease.id,
      targetAsset.id,
    );

    const assetData = asset.data;

    return { targetAsset, assetData };
  }

  createRelease(r: Release, repository: string, owner: string): ReleaseDto {
    return {
      id: r.id,
      owner: owner,
      repoName: repository,
      description: r.body,
      version: r.tag_name,
      prerelease: r.prerelease,
      assets: this.createReleaseAssets(r.assets),
    } as ReleaseDto;
  }

  createReleaseAsset(asset: Attachment): ReleaseAssetDto {
    const filename = path.basename(asset.name!, ".zip");
    const filenameRegex = /^(.*?)-v(\d+\.\d+(?:\.\d+)?(?:-[a-z]+\.\d+)?)-([^-]+)-([^-]+)$/
    const match = filename.match(filenameRegex);
    if (match == null) {
      throw new Error(`Failed to parse filename: ${filename}`)
    }
    return {
      arch: match[4],
      contentLength: asset.size,
      id: asset.id,
      fileName: asset.name,
      platform: match[3],
      version: match[2],
      releaseDate: new Date(asset.created_at!),
    } as ReleaseAssetDto;
  }

  createReleaseAssets(assets: Attachment[] | undefined): ReleaseAssetDto[] {
    if (assets == null) return [] as ReleaseAssetDto[];

    return assets.map((asset) => this.createReleaseAsset(asset));
  }
}
