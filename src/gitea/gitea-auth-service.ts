import path from "path";
import os from "node:os";
import { validateEnvironmentVariable } from "../util";

export type GiteaCredentials = {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
};

export class GiteaAuthService {
  giteaCredentialFile = "gitea_credentials.json";
  storedCredentials: GiteaCredentials | null;

  constructor() {
    this.storedCredentials = null;
  }

  async getAccessToken(): Promise<string> {
    this.storedCredentials = await this.loadCredentials();
    if (this.storedCredentials == null) {
      throw new Error(
        "No credentials have been persisted. Please login with /gitea/auth.",
      );
    }

    const currentTime = new Date().getTime() / 1000;
    if (currentTime > this.storedCredentials.expires_in) {
      console.log(
        `[Gitea] Access token expires: ${this.storedCredentials.expires_in}`,
      );
      console.log(`[Gitea] Current time: ${currentTime}`);
      console.log("[Gitea] Access token has expired, renewing...");
      await this.refreshAuthToken();
    }

    return this.storedCredentials.access_token;
  }

  async refreshAuthToken() {
    const clientId = validateEnvironmentVariable("GITEA_CLIENT_ID");
    const clientSecret = validateEnvironmentVariable("GITEA_CLIENT_SECRET");
    const giteaServer = validateEnvironmentVariable("GITEA_SERVER");
    const redirectUri = validateEnvironmentVariable("GITEA_REDIRECT_URI");
    const requestUrl = `${giteaServer}/login/oauth/access_token`;

    const requestBody = {
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: this.storedCredentials?.refresh_token,
      grant_type: "refresh_token",
      redirect_uri: redirectUri,
    };

    const resp = await fetch(requestUrl, {
      method: "POST",
      body: JSON.stringify(requestBody),
      headers: { "Content-Type": "application/json" },
    });

    const body = await resp.json();

    if (!resp.ok) throw new Error(JSON.stringify(body));

    this.persistCredentials(body as GiteaCredentials);
    this.storedCredentials = await this.loadCredentials();
  }

  async login(code: string) {
    const clientId = validateEnvironmentVariable("GITEA_CLIENT_ID");
    const clientSecret = validateEnvironmentVariable("GITEA_CLIENT_SECRET");
    const giteaServer = validateEnvironmentVariable("GITEA_SERVER");
    const redirectUri = validateEnvironmentVariable("GITEA_REDIRECT_URI");
    const requestUrl = `${giteaServer}/login/oauth/access_token`;

    const requestBody = {
      client_id: clientId,
      client_secret: clientSecret,
      code: code,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
    };

    const resp = await fetch(requestUrl, {
      method: "POST",
      body: JSON.stringify(requestBody),
      headers: { "Content-Type": "application/json" },
    });
    const body = await resp.json();

    if (!resp.ok) throw new Error(JSON.stringify(body));

    this.persistCredentials(body as GiteaCredentials);
  }

  getDataDirectory(): string {
    if (Bun.env.RUNNING_IN_DOCKER === "true") return "/data";
    return path.join(os.homedir(), ".config", "constellation");
  }

  async persistCredentials(credentials: GiteaCredentials) {
    const now = new Date();
    const tokenDetails = {
      access_token: credentials.access_token,
      refresh_token: credentials.refresh_token,
      expires_in: now.getTime() / 1000 + credentials.expires_in,
    };

    await Bun.write(
      path.join(this.getDataDirectory(), this.giteaCredentialFile),
      JSON.stringify(tokenDetails),
    );
  }

  async loadCredentials(): Promise<GiteaCredentials | null> {
    const filePath = path.join(
      this.getDataDirectory(),
      this.giteaCredentialFile,
    );
    const credentialFile = Bun.file(filePath);
    const fileExists = await credentialFile.exists();
    if (!fileExists) {
      return null;
    }

    return (await credentialFile.json()) as GiteaCredentials;
  }
}
