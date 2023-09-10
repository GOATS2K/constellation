import { ReleaseAssetDto } from "./release-asset-dto";

export interface ReleaseDto {
  repoName: string;
  version: string;
  description: string;
  assets: ReleaseAssetDto[];
}
