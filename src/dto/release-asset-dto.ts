export interface ReleaseAssetDto {
  id: number;
  version: string;
  platform: string;
  arch: string;
  fileName: string;
  url: string;
  contentLength: number;
  releaseDate: Date;
}
