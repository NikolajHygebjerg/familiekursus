import { createHmac, timingSafeEqual } from "crypto";
import { getFamilyMembersByLogin, normalizeLoginName, normalizeMemberName } from "@/lib/airtable";

const CHALLENGE_TTL_MS = 15 * 60 * 1000;

type ChallengePayload = {
  login: string;
  expectedNavn: string;
  alder: number;
  exp: number;
};

function challengeSecret(): string {
  return (
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    process.env.KURSUSLEDER_BOOTSTRAP_CODE?.trim() ||
    "familiekursus-forgot-code-dev"
  );
}

function signBody(body: string): string {
  return createHmac("sha256", challengeSecret()).update(body).digest("base64url");
}

export function createForgotCodeChallengeToken(payload: ChallengePayload): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${signBody(body)}`;
}

function parseForgotCodeChallengeToken(token: string): ChallengePayload | null {
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = signBody(body);
  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }
  try {
    const json = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as ChallengePayload;
    if (!json.login || !json.expectedNavn || typeof json.alder !== "number" || typeof json.exp !== "number") {
      return null;
    }
    if (Date.now() > json.exp) return null;
    return json;
  } catch {
    return null;
  }
}

function memberIsChildForChallenge(alder: number | null, type: string | null | undefined): boolean {
  if (alder != null) return alder < 18;
  const t = type?.trim().toLowerCase();
  return t === "barn";
}

export async function issueForgotCodeChildChallenge(
  login: string
): Promise<{ alder: number; challengeToken: string } | { error: string; status: number }> {
  const normalized = normalizeLoginName(login);
  const members = await getFamilyMembersByLogin(normalized);
  const children = members.filter((m) => {
    if (!m.navn?.trim()) return false;
    if (!memberIsChildForChallenge(m.alder, m.type)) return false;
    return m.alder != null;
  });

  if (children.length === 0) {
    return {
      error:
        "Vi kan ikke stille et sikkerhedsspørgsmål — der er ingen børn med alder i jeres familieliste. Kontakt kursuslederen.",
      status: 404,
    };
  }

  const pick = children[Math.floor(Math.random() * children.length)];
  const alder = pick.alder as number;
  const challengeToken = createForgotCodeChallengeToken({
    login: normalized.toLowerCase(),
    expectedNavn: normalizeMemberName(pick.navn),
    alder,
    exp: Date.now() + CHALLENGE_TTL_MS,
  });

  return { alder, challengeToken };
}

export function verifyForgotCodeChildAnswer(
  login: string,
  challengeToken: string,
  answerNavn: string
): boolean {
  const payload = parseForgotCodeChallengeToken(challengeToken);
  if (!payload) return false;
  if (payload.login !== normalizeLoginName(login).toLowerCase()) return false;
  return normalizeMemberName(answerNavn) === payload.expectedNavn;
}
