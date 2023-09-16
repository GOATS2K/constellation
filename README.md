# constellation

Distribute your GitHub releases in your closed-source projects.

Constellation works by querying GitHub to fetch releases created in your private projects.

## Requirements

- [bun](https://bun.sh)
- GitHub [personal access token](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens) with read access to your repositories

### Note about release names

To ensure that Constellation is able to parse your releases for version, platform and target CPU architecture - ensure that your release filenames follow this naming convention.

```text
$application_name-$version-$platform-$architecture
constellation-v0.1.0-darwin-aarch64.zip
```

*This will probably change in the future.*

## Configuration

Using either a `.env` file in Constellation's root directory, or exporting variables using Docker or your favorite shell, set the following variables:

- `GITHUB_TOKEN` - containing your private access token
- `JWT_SECRET_KEY` - a strong key used to sign JWT tokens

## Installation

### Local

```bash
bun install
```

### Docker

```yml
services:
  constellation:
    container_name: constellation
    image: goats2k/constellation:0.1.0
    restart: unless-stopped
    environment:
      - GITHUB_TOKEN=<your-pat-here>
      - JWT_SECRET_KEY=<your-secret-key-here>
    ports:
      - 127.0.0.1:8000:8000
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
- GET `/versions/<version>?platform=<platform>&arch=<arch>`
  - This returns the actual release with a download link.
