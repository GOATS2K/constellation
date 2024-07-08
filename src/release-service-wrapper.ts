import { Octokit } from "@octokit/rest";
import { GithubReleaseService } from "./github/github-release-service";
import { IReleaseService } from "./irelease-service";
import { validateEnvironmentVariable } from "./util";
import { GiteaAuthService } from "./gitea/gitea-auth-service";
import { GiteaReleaseService } from "./gitea/gitea-release-service";
import { ReleaseAssetDownloadDto } from "./dto/release-asset-download";
import { ReleaseDto } from "./dto/release-dto";
import { ReleaseStream } from "./dto/release-stream";

export class ReleaseService implements IReleaseService {
  
  async getReleaseAssetStream(repository: string, version: string, platform: string, arch: string): Promise<ReleaseStream> {
    return await this.getActiveService().getReleaseAssetStream(repository, version, platform, arch);
  }
  
  getActiveService(): IReleaseService {
    if (Bun.env.GITHUB_TOKEN != null) {
      return new GithubReleaseService(
        new Octokit({ auth: validateEnvironmentVariable("GITHUB_TOKEN") }),
      );
    }

    if (Bun.env.GITEA_SERVER != null) {
      const authService = new GiteaAuthService();
      return new GiteaReleaseService(authService);
    }

    throw new Error(
      "Neither GITHUB_TOKEN or GITEA_SERVER is set. Cannot determine which source to use for releases.",
    );
  }

  async getRelease(
    repository: string,
    version: string,
    platform: string,
    arch: string,
  ): Promise<ReleaseAssetDownloadDto> {
    return await this.getActiveService().getRelease(
      repository,
      version,
      platform,
      arch,
    );
  }

  async getReleasesForRepo(repository: string): Promise<ReleaseDto[]> {
    return await this.getActiveService().getReleasesForRepo(repository);
  }
}
