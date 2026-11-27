-- DelftRate schema, part 5: an account never keeps a password from before its email address
-- was confirmed.
--
-- Registering takes two steps (see app/(auth)/actions.ts). Step 1 makes an unconfirmed
-- account; step 2 confirms the address with the emailed code and only then saves the
-- password the student chose. Supabase Auth does those one after another. Anyone can make
-- an unconfirmed account for any address through the public sign-up API, with a password of
-- their own, and Supabase does not replace that password when the real owner registers. So
-- if step 2 stops right after the code is accepted (a timeout, a restart), the address would
-- be confirmed while a stranger knows the password.
--
-- This trigger closes that gap inside the database, in the same write that confirms the
-- address: the password from before is forgotten. The account then has no password until
-- its owner, who is signed in by the code, saves one. If that never happens, nobody can log
-- in with a password, and the owner gets in with "Forgot your password?".
--
-- A write that confirms the address and sets a password together (a lead doing both in the
-- dashboard or through the admin API) keeps that new password. Accounts that are created
-- already confirmed are not touched: the trigger only sees updates.
create function private.forget_password_on_confirmation() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.encrypted_password is not distinct from old.encrypted_password then
    new.encrypted_password := null;
  end if;
  return new;
end;
$$;

create trigger forget_password_on_confirmation
  before update on auth.users
  for each row
  when (old.email_confirmed_at is null and new.email_confirmed_at is not null)
  execute function private.forget_password_on_confirmation();
