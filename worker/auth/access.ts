import { createRemoteJWKSet, jwtVerify } from "jose";
import type { Env } from "../env";

export interface AccessClaims {
  email: string;
  sub: string;
}

export interface AccessTokenVerifier {
  verify(token: string, env: Env): Promise<AccessClaims>;
}

export interface AppDependencies {
  accessVerifier: AccessTokenVerifier;
  now: () => Date;
}

class CloudflareAccessVerifier implements AccessTokenVerifier {
  private readonly keySets = new Map<
    string,
    ReturnType<typeof createRemoteJWKSet>
  >();

  async verify(token: string, env: Env): Promise<AccessClaims> {
    if (!env.ACCESS_TEAM_DOMAIN || !env.ACCESS_AUD) {
      throw new Error("Cloudflare Access is not configured");
    }
    const issuer = new URL(
      env.ACCESS_TEAM_DOMAIN.includes("://")
        ? env.ACCESS_TEAM_DOMAIN
        : `https://${env.ACCESS_TEAM_DOMAIN}`
    ).origin;
    const keyUrl = `${issuer}/cdn-cgi/access/certs`;
    let keySet = this.keySets.get(keyUrl);
    if (!keySet) {
      keySet = createRemoteJWKSet(new URL(keyUrl));
      this.keySets.set(keyUrl, keySet);
    }

    const { payload } = await jwtVerify(token, keySet, {
      issuer,
      audience: env.ACCESS_AUD,
      algorithms: ["RS256"],
    });
    if (
      typeof payload.email !== "string" ||
      typeof payload.sub !== "string" ||
      typeof payload.exp !== "number"
    ) {
      throw new Error("Cloudflare Access claims are incomplete");
    }
    return { email: payload.email, sub: payload.sub };
  }
}

export const defaultDependencies: AppDependencies = {
  accessVerifier: new CloudflareAccessVerifier(),
  now: () => new Date(),
};
