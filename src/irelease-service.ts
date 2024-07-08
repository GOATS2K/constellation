import { ReleaseAssetDownloadDto } from "./dto/release-asset-download";
import { ReleaseDto } from "./dto/release-dto";
import { ReleaseStream } from "./dto/release-stream";

export interface IReleaseService {
  getRelease(
    repository: string,
    version: string,
    platform: string,
    arch: string,
  ): Promise<ReleaseAssetDownloadDto>;
  getReleasesForRepo(repository: string): Promise<ReleaseDto[]>;
  getReleaseAssetStream(repository: string,
    version: string,
    platform: string,
    arch: string): Promise<ReleaseStream>;
}
