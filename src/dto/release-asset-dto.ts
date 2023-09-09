export interface ReleaseAssetDto {
    platform: string;
    arch: string;
    fileName: string;
    url: string;
    contentLength: number;
    releaseDate: Date
}