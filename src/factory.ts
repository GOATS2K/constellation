import { ReleaseService } from "./github/release-service";
import { Octokit } from "@octokit/rest";
import { validateEnvironmentVariable } from "./util";

export class Factory {
  private releaseServiceInstance: ReleaseService | null = null;

  getReleaseService(): ReleaseService {
    if (this.releaseServiceInstance == null) {
      const githubToken = validateEnvironmentVariable("GITHUB_TOKEN");
      const octokit = new Octokit({
        auth: githubToken,
      });
      this.releaseServiceInstance = new ReleaseService(octokit);
    }
    return this.releaseServiceInstance as ReleaseService;
  }
}
