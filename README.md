# constellation

Distribute CI-built releases via the platform that built them in your closed-source projects.

Constellation supports both Gitea and GitHub - but not at the same time.

## Requirements

- [bun](https://bun.sh)
- GitHub [personal access token](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens) with read access to your repositories
- Alternatively, a Gitea host + Oauth application client ID and secret

### Note about release names

To ensure that Constellation is able to parse your releases for version, platform and target CPU architecture - ensure that your release filenames follow this naming convention.

```text
$application_name-$version-$platform-$architecture
constellation-v0.1.0-darwin-aarch64.zip
```

## Configuration

Using either a `.env` file in Constellation's root directory, or exporting variables using Docker or your favorite shell, set the following variables:

- `JWT_SECRET_KEY` - a strong key used to sign JWT tokens

Below you will find environment variables that determine which source Constellation will look for releases in. GitHub will be checked first - then Gitea. If you leave out the GitHub token, Gitea will be used and vice versa.

### GitHub
- `GITHUB_TOKEN` - containing your private access token

### Gitea
- `GITEA_SERVER` - your Gitea server instance - e.g. `https://git.coolcompany.com`
- `GITEA_CLIENT_ID` - belonging to your [OAuth application](https://docs.gitea.com/development/oauth2-provider)
- `GITEA_CLIENT_SECRET` - also belonging to your OAuth application

You can create an OAuth application by going to your user/organization's Settings page, then Applications on the left hand side - then you'll find a section called "Manage OAuth2 Applications".

Make sure to point the redirect URI to your Constellation instance, such as `https://constellation.nectarine.sh/gitea/callback` if you've deployed it somewhere or `http://localhost:8000/gitea/callback` if you're running it locally.

Then, when Constellation has started, visit `/gitea/auth` to login to access your releases.

## Installation

### Local

```bash
bun install
```

### Docker
**Note**: You must use either Gitea and GitHub as your asset source. You cannot use both at the same time.

### GitHub
```yml
services:
  constellation:
    container_name: constellation
    image: goats2k/constellation:0.3.1
    restart: unless-stopped
    environment:
      - GITHUB_TOKEN=<your-pat-here>
      - JWT_SECRET_KEY=<your-secret-key-here>
      - GITEA_SERVER=https://git.nectarine.sh
      - GITEA_CLIENT_ID=my-fun-client-id-here
      - GITEA_CLIENT_SECRET=super-secret-client-id
    ports:
      - 127.0.0.1:8000:8000
```

### Gitea

```yml
services:
  constellation:
    container_name: constellation
    image: goats2k/constellation:0.3.1
    restart: unless-stopped
    environment:
      - JWT_SECRET_KEY=<your-secret-key-here>
      - GITEA_SERVER=https://git.nectarine.sh
      - GITEA_CLIENT_ID=my-fun-client-id-here
      - GITEA_CLIENT_SECRET=super-secret-client-id
    ports:
      - 127.0.0.1:8000:8000
    volumes:
      - "/home/goats2k/.container-data/constellation:/data"
```


## Usage

### Generating a bearer token for your application

Constellation uses a claim in the supplied bearer token to figure out what repository it should look for releases in.

This is to make sure the application is only able to fetch releases from its own repository and to make enumeration of other projects impossible.

To generate a token pointing to a repository, run the following command:

```bash
bun run create-token <repository-name>
```

Alternatively, if running via Docker, after setting up the image:

```bash
docker exec -it constellation bun run create-token <repository-name>
```

Which will output the following:

```text
JWT token for <repository-name>: <your token here>
```

## Running Constellation

### Local

```bash
bun start
```

### Docker (if using the supplied Compose file)
```
docker compose up -d
```

## Getting releases

Set the token from the `create-token` command in an Authorization header.

```text
Authorization: Bearer <token>
```

Constellation exposes the following endpoints for updates:

- GET `/versions`
  - This returns every release available in your repository.
- GET `/versions?includePrerelease=true`
  - This returns every release, including prereleases, available in your repository.
- GET `/versions/<version>?platform=<platform>&arch=<arch>`
  - This returns the actual release with a download link.
