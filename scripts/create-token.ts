import * as jose from "jose";
import { validateEnvironmentVariable } from "../src/util";

const repositoryName = Bun.argv[Bun.argv.length - 1];
const secretKey = validateEnvironmentVariable("JWT_SECRET_KEY");
const signKey = new jose.SignJWT({ repository: repositoryName })
  .setAudience("Constellation Server")
  .setIssuer("Constellation")
  .setProtectedHeader({ alg: "HS256" });
console.log(
  `JWT token for ${repositoryName}: ${await signKey.sign(
    new TextEncoder().encode(secretKey)
  )}`
);
