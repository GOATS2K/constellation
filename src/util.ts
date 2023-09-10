export const correctPlatformName = (platform: string): string => {
    switch (platform.toLowerCase()) {
        case "darwin":
            return "macos";
        case "mac":
            return "macos";
        case "win":
            return "windows";
    }
    return platform
}

export const correctArchitecture = (arch: string): string => {
    switch (arch.toLowerCase()) {
        case "aarch64":
            return "arm64";
    }
    return arch;
}

export const correctVersionNumber = (version: string): string => {
    if (!version.startsWith("v") && version !== "latest") {
        return `v${version}`;
    }
    return version;
}