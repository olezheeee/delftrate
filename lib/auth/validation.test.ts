import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PROGRAMMES, YEARS } from "./programmes";
import {
  codeError,
  emailError,
  normalizeCode,
  normalizeEmail,
  passwordError,
  validateCode,
  validateEmailOnly,
  validateLogin,
  validatePasswordReset,
  validateProfile,
  validateRegistration,
} from "./validation";

const good = {
  email: "s.student@student.tudelft.nl",
  code: "123456",
  password: "correct horse",
  programme: "CSE",
  year: "2",
};

describe("email", () => {
  it("is trimmed and lower-cased", () => {
    expect(normalizeEmail("  S.Student@Student.TUDelft.nl ")).toBe("s.student@student.tudelft.nl");
    expect(normalizeEmail(undefined)).toBe("");
    expect(normalizeEmail(42)).toBe("");
  });

  it.each(["a@b.nl", "s.student@student.tudelft.nl", "first.last+tag@example.co.uk"])(
    "accepts %s",
    (email) => expect(emailError(email)).toBeUndefined(),
  );

  it.each(["", "plain", "@b.nl", "a@", "a@b", "a b@c.nl", "a@b@c.nl", `${"a".repeat(250)}@b.nl`])(
    "rejects %j",
    (email) => expect(emailError(email)).toBeTypeOf("string"),
  );
});

describe("password", () => {
  it("needs at least 8 characters", () => {
    expect(passwordError("")).toBe("Enter a password.");
    expect(passwordError("1234567")).toMatch(/at least 8/);
    expect(passwordError("12345678")).toBeUndefined();
  });

  it("is not trimmed: spaces are part of it", () => {
    expect(passwordError("        ")).toBeUndefined();
  });

  it("cannot be longer than what is stored", () => {
    expect(passwordError("a".repeat(72))).toBeUndefined();
    expect(passwordError("a".repeat(73))).toMatch(/too long/);
    // 25 characters, but 75 bytes.
    expect(passwordError("€".repeat(25))).toMatch(/too long/);
  });
});

describe("code", () => {
  it("ignores spaces", () => {
    expect(normalizeCode(" 123 456\n")).toBe("123456");
  });

  it("is exactly six digits", () => {
    expect(codeError("123456")).toBeUndefined();
    expect(codeError("")).toMatch(/Enter the code/);
    for (const bad of ["12345", "1234567", "12345a", "１２３４５６"]) {
      expect(codeError(bad), bad).toMatch(/6 digits/);
    }
  });
});

describe("registration", () => {
  it("accepts a complete form and returns clean values", () => {
    expect(validateRegistration({ ...good, email: " S.Student@student.tudelft.nl " })).toEqual({
      ok: true,
      data: {
        email: "s.student@student.tudelft.nl",
        code: "123456",
        password: "correct horse",
        programme: "CSE",
        year: 2,
      },
    });
  });

  it("reports every wrong field at once", () => {
    const result = validateRegistration({ email: "nope", code: "12", password: "short", programme: "", year: "" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(Object.keys(result.errors).sort()).toEqual(["code", "email", "password", "programme", "year"]);
    }
  });

  it("rejects a programme or year that is not offered", () => {
    for (const patch of [{ programme: "LAW" }, { programme: "cse" }, { year: "0" }, { year: "4" }, { year: "2.0" }, { year: " 2" }]) {
      expect(validateRegistration({ ...good, ...patch }).ok, JSON.stringify(patch)).toBe(false);
    }
  });

  it("survives fields that are missing or are not text", () => {
    const result = validateRegistration({ email: null, code: 123456, password: undefined, programme: {}, year: 2 });
    expect(result.ok).toBe(false);
  });
});

describe("the programmes and years on offer", () => {
  it("match the programmes in the database migration", () => {
    const sql = readFileSync(join(import.meta.dirname, "../../supabase/migrations/20261124000001_tables.sql"), "utf8");
    for (const programme of PROGRAMMES) {
      expect(sql, programme.id).toContain(`('${programme.id}', '${programme.name}')`);
    }
    expect(sql.match(/^  \('[A-Z]+', '[^']+'\)[,;]$/gm)).toHaveLength(PROGRAMMES.length);
  });

  it("stay inside the years the database accepts", () => {
    for (const year of YEARS) expect(year >= 1 && year <= 5).toBe(true);
  });
});

describe("profile", () => {
  it("accepts an offered programme and year", () => {
    expect(validateProfile({ programme: "AE", year: "3" })).toEqual({ ok: true, data: { programme: "AE", year: 3 } });
  });

  it("names the field that is wrong", () => {
    expect(validateProfile({ programme: "AE", year: "9" })).toEqual({ ok: false, errors: { year: "Choose your year." } });
  });
});

describe("login", () => {
  it("only needs both fields: old, shorter passwords still work", () => {
    expect(validateLogin({ email: "A@b.nl", password: "abc" })).toEqual({
      ok: true,
      data: { email: "a@b.nl", password: "abc" },
    });
  });

  it("rejects an empty password or a wrong email", () => {
    expect(validateLogin({ email: "a@b.nl", password: "" }).ok).toBe(false);
    expect(validateLogin({ email: "a", password: "abc" }).ok).toBe(false);
  });
});

describe("code forms", () => {
  it("email only", () => {
    expect(validateEmailOnly({ email: " A@B.nl" })).toEqual({ ok: true, data: { email: "a@b.nl" } });
    expect(validateEmailOnly({ email: "" }).ok).toBe(false);
  });

  it("verification needs the email and a well-formed code", () => {
    expect(validateCode({ email: "a@b.nl", code: "123 456" })).toEqual({
      ok: true,
      data: { email: "a@b.nl", code: "123456" },
    });
    expect(validateCode({ email: "", code: "123456" }).ok).toBe(false);
    expect(validateCode({ email: "a@b.nl", code: "12" }).ok).toBe(false);
  });

  it("a password reset also needs a valid new password", () => {
    expect(validatePasswordReset({ email: "a@b.nl", code: "123456", password: "new password" }).ok).toBe(true);
    const result = validatePasswordReset({ email: "a@b.nl", code: "1", password: "short" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(Object.keys(result.errors).sort()).toEqual(["code", "password"]);
  });
});
