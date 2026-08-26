import { createServerClient } from "@supabase/ssr";
import {
  NextResponse,
  type NextRequest,
} from "next/server";

type AccountType = "customer" | "contractor";

function matchesRoute(
  pathname: string,
  route: string
) {
  return (
    pathname === route ||
    pathname.startsWith(`${route}/`)
  );
}

export async function updateSession(
  request: NextRequest
) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env
      .NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },

        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(
            ({ name, value }) => {
              request.cookies.set(name, value);
            }
          );

          supabaseResponse = NextResponse.next({
            request,
          });

          cookiesToSet.forEach(
            ({ name, value, options }) => {
              supabaseResponse.cookies.set(
                name,
                value,
                options
              );
            }
          );

          Object.entries(headers).forEach(
            ([key, value]) => {
              supabaseResponse.headers.set(
                key,
                value
              );
            }
          );
        },
      },
    }
  );

  const { data: claimsData } =
    await supabase.auth.getClaims();

  const userId =
    typeof claimsData?.claims?.sub === "string"
      ? claimsData.claims.sub
      : null;

  const isLoggedIn = Boolean(userId);
  const pathname = request.nextUrl.pathname;

  const protectedRoutes = [
    "/dashboard",
    "/projects",
    "/my-projects",
    "/profile",
    "/requests",
    "/sent-requests",
    "/contact",
  ];

  const contractorOnlyRoutes = [
    "/projects",
    "/my-projects",
    "/profile",
    "/requests",
  ];

  const customerOnlyRoutes = [
    "/sent-requests",
    "/contact",
  ];

  const isProtectedPage =
    protectedRoutes.some((route) =>
      matchesRoute(pathname, route)
    );

  if (!isLoggedIn && isProtectedPage) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth";

    return NextResponse.redirect(url);
  }

  if (!isLoggedIn || !userId) {
    return supabaseResponse;
  }

  let accountType: AccountType | null = null;

  const {
    data: accountData,
    error: accountError,
  } = await supabase
    .from("user_accounts")
    .select("account_type")
    .eq("id", userId)
    .maybeSingle();

  if (!accountError && accountData) {
    accountType =
      accountData.account_type as AccountType;
  }

  /*
   * Contractor onboarding:
   * Contractors without a profile must complete
   * their profile before using the platform.
   */
  if (accountType === "contractor") {
    const {
      data: profileData,
      error: profileError,
    } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", userId)
      .maybeSingle();

    const profileExists =
      !profileError && Boolean(profileData);

    const isProfilePage =
      matchesRoute(pathname, "/profile");

    if (!profileExists && !isProfilePage) {
      const url = request.nextUrl.clone();
      url.pathname = "/profile";

      return NextResponse.redirect(url);
    }
  }

  if (pathname === "/auth") {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";

    return NextResponse.redirect(url);
  }

  const isContractorOnlyPage =
    contractorOnlyRoutes.some((route) =>
      matchesRoute(pathname, route)
    );

  const isCustomerOnlyPage =
    customerOnlyRoutes.some((route) =>
      matchesRoute(pathname, route)
    );

  if (
    accountType === "customer" &&
    isContractorOnlyPage
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";

    return NextResponse.redirect(url);
  }

  if (
    accountType === "contractor" &&
    isCustomerOnlyPage
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";

    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}