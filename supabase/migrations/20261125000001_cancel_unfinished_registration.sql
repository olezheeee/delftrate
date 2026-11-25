-- DelftRate schema, part 4: undoing a registration that could not be finished.
--
-- An account counts as existing once it has a confirmed email address, a password and a
-- profile. Supabase Auth can only do these one after another: the emailed code confirms the
-- address first, and only then can the password and the profile be saved. When one of those
-- later steps fails, the site calls this function so that no half-made account stays behind
-- and the student can simply register again.
--
-- It removes the caller's own account and nothing else, and only while that account has no
-- profile. An account with a profile is a finished one and is never touched. Returns
-- whether an account was removed.
create function public.cancel_unfinished_registration() returns boolean
language plpgsql security definer
set search_path = ''
as $$
begin
  delete from auth.users u
  where u.id = (select auth.uid())
    and not exists (select 1 from public.profiles p where p.id = u.id);
  return found;
end;
$$;
grant execute on function public.cancel_unfinished_registration() to authenticated;
