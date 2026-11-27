import { describe, expect, it } from "vitest";
import { authErrorMessage, emailSentMomentAgo } from "./errors";

describe("messages for errors from Supabase Auth", () => {
  it("does not say which of email and password was wrong", () => {
    expect(authErrorMessage({ code: "invalid_credentials", status: 400 }, "login")).toBe(
      "The email address or the password is not correct.",
    );
  });

  it("covers a wrong or expired code", () => {
    expect(authErrorMessage({ code: "otp_expired", status: 403 }, "verify")).toMatch(/not correct or has expired/);
    expect(authErrorMessage({ code: "validation_failed", status: 400 }, "reset")).toMatch(/not correct or has expired/);
  });

  it("tells apart the two kinds of waiting", () => {
    expect(authErrorMessage({ code: "over_email_send_rate_limit", status: 429 }, "resend")).toMatch(/too many emails/);
    const soon = "For security purposes, you can only request this after 42 seconds.";
    expect(authErrorMessage({ code: "over_email_send_rate_limit", status: 429, message: soon }, "resend")).toMatch(/Wait a minute/);
    expect(authErrorMessage({ status: 429, message: soon }, "resend")).toMatch(/Wait a minute/);
    expect(authErrorMessage({ status: 429 }, "login")).toMatch(/Too many attempts/);
  });

  it("recognises an email refused only because one was sent a moment ago", () => {
    const soon = "For security purposes, you can only request this after 42 seconds.";
    expect(emailSentMomentAgo({ code: "over_email_send_rate_limit", status: 429, message: soon })).toBe(true);
    expect(emailSentMomentAgo({ status: 429, message: soon })).toBe(true);
    // The hourly limit of the whole site, too many attempts, and anything else are real failures.
    expect(emailSentMomentAgo({ code: "over_email_send_rate_limit", status: 429, message: "email rate limit exceeded" })).toBe(false);
    expect(emailSentMomentAgo({ code: "over_request_rate_limit", status: 429 })).toBe(false);
    expect(emailSentMomentAgo({ code: "unexpected_failure", status: 500, message: soon })).toBe(false);
    expect(emailSentMomentAgo({})).toBe(false);
  });

  it("never shows Supabase's own text for something unknown", () => {
    const message = authErrorMessage({ code: "unexpected_failure", status: 500, message: "pq: relation does not exist" }, "register");
    expect(message).toMatch(/Something went wrong/);
    expect(message).not.toMatch(/pq/);
    expect(authErrorMessage({}, "login")).toMatch(/Something went wrong/);
  });
});
