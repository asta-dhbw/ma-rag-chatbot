export const AUTH_COOKIE_NAME = "keycloak_authenticated";
const DEFAULT_MAX_AGE_SECONDS = 3600;

export function setAuthCookie(response, expiresIn) {
  const maxAge =
    typeof expiresIn === "number" && Number.isFinite(expiresIn) && expiresIn > 0
      ? expiresIn
      : DEFAULT_MAX_AGE_SECONDS;

  response.cookies.set(AUTH_COOKIE_NAME, "true", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge,
  });
  return response;
}