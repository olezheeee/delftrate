-- DelftRate schema, part 11: an account that is created already confirmed keeps its password.
--
-- Part 5 (forget_password_on_confirmation) forgets the password an account had from before
-- its email address was confirmed, so that a stranger who made an unconfirmed account for
-- someone else's address never ends up knowing the password of a confirmed one. Its comment
-- said that accounts created already confirmed are not touched. That was not so: Oreo found
-- on 27 November 2026 that an account a lead creates through the admin API with
-- "email_confirm: true" could not log in, because its password was gone.
--
-- The reason is how Supabase Auth creates such an account (adminUserCreate in its source).
-- It does not insert a confirmed row. Inside one transaction it first inserts the account,
-- unconfirmed and with its password, and then confirms it with a second write. The trigger
-- saw that second write and could not tell it from the case it guards against.
--
-- The difference between the two is when the account was made:
--   - a lead's new account is inserted and confirmed in the same transaction;
--   - a stranger's account was inserted by an earlier request, and is confirmed later, in
--     another transaction, when the real owner types in the emailed code.
-- So the insert leaves a note that lasts until its transaction ends, and the confirmation
-- keeps the password only when the note names this account. The note is a setting local to
-- the transaction of Supabase Auth's own database connection. Nobody reaches it through the
-- API: a request to the API runs on another connection, in a transaction of its own.
--
-- When in doubt the password is forgotten, as before: for a second account made in the
-- same transaction (Supabase Auth makes one per request), and when the insert ran outside
-- a transaction. An account without a password is safe; its owner sets one with "Forgot
-- your password?".
create function private.note_new_account() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- The third argument makes the setting local: it is gone when this transaction ends.
  perform set_config('delftrate.new_account', new.id::text, true);
  return null;
end;
$$;

create trigger note_new_account
  after insert on auth.users
  for each row
  execute function private.note_new_account();

create or replace function private.forget_password_on_confirmation() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.encrypted_password is not distinct from old.encrypted_password
    -- Not the account this same transaction has just made. Without a note the setting is
    -- null, or empty once an earlier transaction on this connection has used it.
    and current_setting('delftrate.new_account', true) is distinct from new.id::text
  then
    new.encrypted_password := null;
  end if;
  return new;
end;
$$;
