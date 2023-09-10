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

```bash
bun install
```

## Usage

### Generating a bearer token for your application

Constellation uses a claim in the supplied bearer token to figure out what repository it should look for releases in.

This is to make sure the application is only able to fetch releases from its own repository and to make enumeration of other projects impossible.

To generate a token pointing to a repository, run the following command:

```bash
bun run create-token <repository-name>
```

Which will output the following:

```text
JWT token for <repository-name>: <your token here>
```

## Running Constellation

```bash
bun start
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
