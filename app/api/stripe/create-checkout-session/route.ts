import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
function isPrelaunchMode() {
  return process.env.PRELAUNCH_MODE === "true";
}
const PLATFORM_FEE_PERCENT = 5;

type CheckoutRequestBody = {
  invoiceId?: string;
};

type InvoiceRow = {
  id: string;
  invoice_number: string;
  request_id: string;
  contractor_id: string;
  customer_id: string;
  amount: string | number;
  description: string | null;
  status: string;
  stripe_checkout_session_id: string | null;
};

function errorResponse(
  message: string,
  status: number
) {
  return NextResponse.json(
    { error: message },
    { status }
  );
}

function getDestinationAccountId(
  paymentIntent: Stripe.PaymentIntent
) {
  const destination =
    paymentIntent.transfer_data?.destination;

  if (!destination) {
    return null;
  }

  return typeof destination === "string"
    ? destination
    : destination.id;
}

export async function POST(
  request: NextRequest
) {
  try {
    if (isPrelaunchMode()) {
  return NextResponse.json(
    {
      error: "Contractorhub is currently in pre-launch mode. Live payments are temporarily disabled.",
    },
    { status: 503 }
  );
}
    const stripeSecretKey =
      process.env.STRIPE_SECRET_KEY;

    const supabaseUrl =
      process.env.NEXT_PUBLIC_SUPABASE_URL;

    const supabasePublishableKey =
      process.env
        .NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

    const supabaseSecretKey =
      process.env.SUPABASE_SECRET_KEY;

    if (!stripeSecretKey) {
      return errorResponse(
        "STRIPE_SECRET_KEY is missing from .env.local.",
        500
      );
    }

    if (
      !supabaseUrl ||
      !supabasePublishableKey ||
      !supabaseSecretKey
    ) {
      return errorResponse(
        "Supabase environment variables are missing.",
        500
      );
    }

    const authorization =
      request.headers.get("authorization");

    if (
      !authorization?.startsWith(
        "Bearer "
      )
    ) {
      return errorResponse(
        "You must be logged in.",
        401
      );
    }

    const accessToken =
      authorization
        .slice("Bearer ".length)
        .trim();

    if (!accessToken) {
      return errorResponse(
        "You must be logged in.",
        401
      );
    }

    let body: CheckoutRequestBody;

    try {
      body =
        (await request.json()) as
          CheckoutRequestBody;
    } catch {
      return errorResponse(
        "Invalid request body.",
        400
      );
    }

    const invoiceId =
      body.invoiceId?.trim();

    if (!invoiceId) {
      return errorResponse(
        "Invoice ID is required.",
        400
      );
    }

    const userSupabase =
      createClient(
        supabaseUrl,
        supabasePublishableKey,
        {
          global: {
            headers: {
              Authorization:
                `Bearer ${accessToken}`,
            },
          },
          auth: {
            persistSession: false,
            autoRefreshToken: false,
            detectSessionInUrl: false,
          },
        }
      );

    const adminSupabase =
      createClient(
        supabaseUrl,
        supabaseSecretKey,
        {
          auth: {
            persistSession: false,
            autoRefreshToken: false,
            detectSessionInUrl: false,
          },
        }
      );

    const {
      data: { user },
      error: userError,
    } =
      await userSupabase.auth.getUser(
        accessToken
      );

    if (userError || !user) {
      return errorResponse(
        "Your login session is invalid. Please sign in again.",
        401
      );
    }

    const {
      data: accountData,
      error: accountError,
    } =
      await userSupabase
        .from("user_accounts")
        .select("account_type")
        .eq("id", user.id)
        .maybeSingle();

    if (accountError) {
      return errorResponse(
        accountError.message,
        400
      );
    }

    if (
      accountData?.account_type !==
      "customer"
    ) {
      return errorResponse(
        "Only customers can pay invoices.",
        403
      );
    }

    const {
      data: invoiceData,
      error: invoiceError,
    } =
      await userSupabase
        .from("project_invoices")
        .select(`
          id,
          invoice_number,
          request_id,
          contractor_id,
          customer_id,
          amount,
          description,
          status,
          stripe_checkout_session_id
        `)
        .eq("id", invoiceId)
        .eq("customer_id", user.id)
        .maybeSingle();

    if (invoiceError) {
      return errorResponse(
        invoiceError.message,
        400
      );
    }

    const invoice =
      invoiceData as InvoiceRow | null;

    if (!invoice) {
      return errorResponse(
        "Invoice not found or you do not have permission to pay it.",
        404
      );
    }

    if (invoice.status === "paid") {
      return errorResponse(
        "This invoice has already been paid.",
        409
      );
    }

    if (invoice.status !== "sent") {
      return errorResponse(
        "Only sent invoices can be paid.",
        400
      );
    }

    const amount =
      Number(invoice.amount);

    if (
      !Number.isFinite(amount) ||
      amount <= 0
    ) {
      return errorResponse(
        "The invoice amount is invalid.",
        400
      );
    }

    const amountInCents =
      Math.round(amount * 100);

    if (
      !Number.isSafeInteger(
        amountInCents
      )
    ) {
      return errorResponse(
        "The invoice amount is too large.",
        400
      );
    }

    const platformFeeInCents =
      Math.round(
        amountInCents *
          (PLATFORM_FEE_PERCENT / 100)
      );

    const contractorNetInCents =
      amountInCents -
      platformFeeInCents;

    if (
      platformFeeInCents < 0 ||
      contractorNetInCents <= 0
    ) {
      return errorResponse(
        "The platform fee calculation is invalid.",
        400
      );
    }

    const stripe =
      new Stripe(stripeSecretKey);

    /*
      Find the contractor's Stripe Connected Account.
      The browser never supplies this account ID.
      We only trust the server-side Supabase record.
    */
    const {
      data: connectedAccountData,
      error: connectedAccountError,
    } =
      await adminSupabase
        .from(
          "contractor_stripe_accounts"
        )
        .select(`
          stripe_account_id,
          transfers_status
        `)
        .eq(
          "contractor_id",
          invoice.contractor_id
        )
        .maybeSingle();

    if (connectedAccountError) {
      return errorResponse(
        connectedAccountError.message,
        500
      );
    }

    if (
      !connectedAccountData
        ?.stripe_account_id
    ) {
      return errorResponse(
        "This contractor has not connected Stripe yet.",
        409
      );
    }

    const destinationAccountId =
      connectedAccountData
        .stripe_account_id;

    /*
      Check Stripe itself before accepting payment.
      We do not rely only on the status stored in Supabase.
    */
    const connectedAccount =
      await stripe.accounts.retrieve(
        destinationAccountId
      );

    if (
      "deleted" in connectedAccount &&
      connectedAccount.deleted
    ) {
      return errorResponse(
        "The contractor's Stripe account is no longer available.",
        409
      );
    }

    const transfersStatus =
      connectedAccount.capabilities
        ?.transfers ?? "inactive";

    const payoutsEnabled =
      connectedAccount.payouts_enabled;

    await adminSupabase
      .from(
        "contractor_stripe_accounts"
      )
      .update({
        transfers_status:
          transfersStatus,
        updated_at:
          new Date().toISOString(),
        last_synced_at:
          new Date().toISOString(),
      })
      .eq(
        "contractor_id",
        invoice.contractor_id
      );

    if (
      transfersStatus !== "active" ||
      !payoutsEnabled
    ) {
      return errorResponse(
        "The contractor must finish Stripe setup before receiving payments.",
        409
      );
    }

    /*
      Reuse a Checkout Session only when it was created
      with the current Connect destination and 5% fee.
      Older sessions are expired so they cannot bypass
      the new marketplace payment split.
    */
    if (
      invoice
        .stripe_checkout_session_id
    ) {
      try {
        const existingSession =
          await stripe.checkout.sessions
            .retrieve(
              invoice
                .stripe_checkout_session_id
            );

        if (
          existingSession.status ===
            "open" &&
          existingSession.url
        ) {
          const usesCurrentConnectSetup =
            existingSession.metadata
              ?.stripe_destination_account_id ===
              destinationAccountId &&
            existingSession.metadata
              ?.platform_fee_percent ===
              String(
                PLATFORM_FEE_PERCENT
              ) &&
            existingSession.metadata
              ?.platform_fee_amount_cents ===
              String(
                platformFeeInCents
              );

          const usesCustomerCreation =
            existingSession.customer_creation ===
            "always";

          if (
            usesCurrentConnectSetup &&
            usesCustomerCreation
          ) {
            return NextResponse.json({
              url: existingSession.url,
              reused: true,
              platformFeePercent:
                PLATFORM_FEE_PERCENT,
              platformFeeAmount:
                platformFeeInCents /
                100,
              contractorNetAmount:
                contractorNetInCents /
                100,
            });
          }

          try {
            await stripe
              .checkout.sessions.expire(
                existingSession.id
              );
          } catch (
            expireOldError
          ) {
            console.error(
              "Could not expire old Checkout Session:",
              expireOldError
            );
          }

          const {
            error: clearOldError,
          } =
            await adminSupabase
              .from(
                "project_invoices"
              )
              .update({
                stripe_checkout_session_id:
                  null,
                stripe_checkout_created_at:
                  null,
                updated_at:
                  new Date()
                    .toISOString(),
              })
              .eq(
                "id",
                invoice.id
              )
              .eq(
                "status",
                "sent"
              );

          if (clearOldError) {
            return errorResponse(
              clearOldError.message,
              500
            );
          }
        }

        if (
          existingSession.status ===
            "complete" &&
          existingSession
            .payment_status === "paid"
        ) {
          if (
            existingSession.currency !==
              "aud" ||
            existingSession
              .amount_total !==
              amountInCents ||
            existingSession.metadata
              ?.invoice_id !==
              invoice.id ||
            existingSession.metadata
              ?.customer_id !==
              invoice.customer_id ||
            existingSession.metadata
              ?.contractor_id !==
              invoice.contractor_id
          ) {
            return errorResponse(
              "Stripe payment details do not match this invoice.",
              400
            );
          }

          const paymentIntentId =
            typeof existingSession
              .payment_intent ===
            "string"
              ? existingSession
                  .payment_intent
              : existingSession
                  .payment_intent?.id ??
                null;

          if (!paymentIntentId) {
            return errorResponse(
              "Stripe payment is missing its PaymentIntent.",
              500
            );
          }

          const paymentIntent =
            await stripe.paymentIntents
              .retrieve(
                paymentIntentId
              );

          const paidDestination =
            getDestinationAccountId(
              paymentIntent
            );

          if (
            paymentIntent.status !==
              "succeeded" ||
            paymentIntent.amount !==
              amountInCents ||
            paymentIntent.currency !==
              "aud" ||
            paymentIntent
              .application_fee_amount !==
              platformFeeInCents ||
            paidDestination !==
              destinationAccountId
          ) {
            return errorResponse(
              "Stripe Connect payment details do not match this invoice.",
              400
            );
          }

          const {
            data: syncedInvoice,
            error: syncError,
          } =
            await adminSupabase
              .from(
                "project_invoices"
              )
              .update({
                status: "paid",
                paid_at:
                  new Date(
                    paymentIntent.created *
                      1000
                  ).toISOString(),
                payment_reference:
                  paymentIntentId,
                stripe_checkout_session_id:
                  existingSession.id,
                stripe_payment_intent_id:
                  paymentIntentId,
                stripe_checkout_created_at:
                  new Date(
                    existingSession
                      .created * 1000
                  ).toISOString(),
                platform_fee_percent:
                  PLATFORM_FEE_PERCENT,
                platform_fee_amount:
                  platformFeeInCents /
                  100,
                contractor_net_amount:
                  contractorNetInCents /
                  100,
                stripe_destination_account_id:
                  destinationAccountId,
                customer_seen: true,
                contractor_seen: false,
                updated_at:
                  new Date()
                    .toISOString(),
              })
              .eq(
                "id",
                invoice.id
              )
              .eq(
                "customer_id",
                user.id
              )
              .eq(
                "status",
                "sent"
              )
              .select("id")
              .maybeSingle();

          if (syncError) {
            return errorResponse(
              syncError.message,
              500
            );
          }

          return NextResponse.json({
            alreadyPaid: true,
            synced:
              Boolean(
                syncedInvoice
              ),
          });
        }

        /*
          Completed-unpaid or expired Sessions
          cannot be reused.
        */
        if (
          existingSession.status !==
          "open"
        ) {
          const {
            error: clearError,
          } =
            await adminSupabase
              .from(
                "project_invoices"
              )
              .update({
                stripe_checkout_session_id:
                  null,
                stripe_checkout_created_at:
                  null,
                updated_at:
                  new Date()
                    .toISOString(),
              })
              .eq(
                "id",
                invoice.id
              )
              .eq(
                "status",
                "sent"
              );

          if (clearError) {
            return errorResponse(
              clearError.message,
              500
            );
          }
        }
      } catch (retrieveError) {
        const stripeError =
          retrieveError as {
            code?: string;
          };

        if (
          stripeError.code !==
          "resource_missing"
        ) {
          throw retrieveError;
        }

        const {
          error: clearMissingError,
        } =
          await adminSupabase
            .from(
              "project_invoices"
            )
            .update({
              stripe_checkout_session_id:
                null,
              stripe_checkout_created_at:
                null,
              updated_at:
                new Date()
                  .toISOString(),
            })
            .eq(
              "id",
              invoice.id
            )
            .eq(
              "status",
              "sent"
            );

        if (clearMissingError) {
          return errorResponse(
            clearMissingError.message,
            500
          );
        }
      }
    }

    const origin =
      request.nextUrl.origin;

    const nowInSeconds =
      Math.floor(
        Date.now() / 1000
      );

    const checkoutLifetimeSeconds =
      31 * 60;

    const checkoutBucket =
      Math.floor(
        nowInSeconds /
          (30 * 60)
      );

    /*
      v2 is intentionally included so Checkout Sessions
      created before automatic Customer creation cannot be
      returned by Stripe idempotency after this upgrade.
    */
    const idempotencyKey =
      `invoice-checkout-connect-v2-${invoice.id}-${checkoutBucket}`;

    const session =
      await stripe.checkout.sessions.create(
        {
          mode: "payment",
          adaptive_pricing: {
  enabled: false,
},
          payment_method_types: [
            "card",
          ],
          client_reference_id:
            invoice.id,
          customer_email:
            user.email ?? undefined,
          customer_creation: "always",
          expires_at:
            nowInSeconds +
            checkoutLifetimeSeconds,

          line_items: [
            {
              quantity: 1,
              price_data: {
                currency: "aud",
                unit_amount:
                  amountInCents,
                product_data: {
                  name:
                    `Invoice ${invoice.invoice_number}`,
                  description:
                    invoice.description
                      ?.slice(0, 500) ||
                    "Contractor project invoice",
                },
              },
            },
          ],

          metadata: {
            invoice_id: invoice.id,
            request_id:
              invoice.request_id,
            customer_id:
              invoice.customer_id,
            contractor_id:
              invoice.contractor_id,
            invoice_number:
              invoice.invoice_number,
            platform_fee_percent:
              String(
                PLATFORM_FEE_PERCENT
              ),
            platform_fee_amount_cents:
              String(
                platformFeeInCents
              ),
            contractor_net_amount_cents:
              String(
                contractorNetInCents
              ),
            stripe_destination_account_id:
              destinationAccountId,
          },

          payment_intent_data: {
            application_fee_amount:
              platformFeeInCents,

            transfer_data: {
              destination:
                destinationAccountId,
            },

            metadata: {
              invoice_id:
                invoice.id,
              request_id:
                invoice.request_id,
              customer_id:
                invoice.customer_id,
              contractor_id:
                invoice.contractor_id,
              invoice_number:
                invoice.invoice_number,
              platform_fee_percent:
                String(
                  PLATFORM_FEE_PERCENT
                ),
              platform_fee_amount_cents:
                String(
                  platformFeeInCents
                ),
              contractor_net_amount_cents:
                String(
                  contractorNetInCents
                ),
              stripe_destination_account_id:
                destinationAccountId,
            },
          },

          success_url:
            `${origin}/my-invoices?payment=success` +
            `&session_id={CHECKOUT_SESSION_ID}`,

          cancel_url:
            `${origin}/my-invoices?payment=cancelled`,
        },
        {
          idempotencyKey,
        }
      );

    if (!session.url) {
      return errorResponse(
        "Stripe did not return a Checkout URL.",
        500
      );
    }

    const {
      data: trackedInvoice,
      error: trackingError,
    } =
      await adminSupabase
        .from("project_invoices")
        .update({
          stripe_checkout_session_id:
            session.id,
          stripe_checkout_created_at:
            new Date(
              session.created * 1000
            ).toISOString(),
          platform_fee_percent:
            PLATFORM_FEE_PERCENT,
          platform_fee_amount:
            platformFeeInCents / 100,
          contractor_net_amount:
            contractorNetInCents /
            100,
          stripe_destination_account_id:
            destinationAccountId,
          updated_at:
            new Date().toISOString(),
        })
        .eq("id", invoice.id)
        .eq(
          "customer_id",
          user.id
        )
        .eq("status", "sent")
        .select("id")
        .maybeSingle();

    if (
      trackingError ||
      !trackedInvoice
    ) {
      try {
        if (
          session.status === "open"
        ) {
          await stripe
            .checkout.sessions.expire(
              session.id
            );
        }
      } catch (expireError) {
        console.error(
          "Could not expire untracked Checkout Session:",
          expireError
        );
      }

      return errorResponse(
        trackingError?.message ??
          "Could not attach Checkout to the invoice.",
        500
      );
    }

    return NextResponse.json({
      url: session.url,
      reused: false,
      platformFeePercent:
        PLATFORM_FEE_PERCENT,
      platformFeeAmount:
        platformFeeInCents / 100,
      contractorNetAmount:
        contractorNetInCents / 100,
    });
  } catch (error) {
    console.error(
      "Stripe Checkout error:",
      error
    );

    return errorResponse(
      error instanceof Error
        ? error.message
        : "Could not create the Stripe Checkout session.",
      500
    );
  }
}