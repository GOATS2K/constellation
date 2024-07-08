import { ReleaseAssetDto } from "./release-asset-dto";

export interface ReleaseDto {
  id: number;
  owner: string,
  repoName: string;
  version: string;
  description: string;
  prerelease: boolean;
  assets: ReleaseAssetDto[];
}
