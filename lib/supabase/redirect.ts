import { NextRequest, NextResponse } from "next/server";

export function redirectWithSession(request: NextRequest, sessionResponse: NextResponse, path: string) {
  const url = new URL(path, request.url);
  const response = NextResponse.redirect(url);
  sessionResponse.cookies.getAll().forEach((cookie) => response.cookies.set(cookie));
  response.headers.set("Cache-Control", "private, no-store");
  for (const name of ["pragma", "expires", "vary"]) {
    const value = sessionResponse.headers.get(name);
    if (value) response.headers.set(name, value);
  }
  return response;
}
