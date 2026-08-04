-- 0004_comment_notifications: in-app notification fan-out for comments.
-- Runs as a security definer trigger because members cannot insert into
-- notifications directly (no RLS insert policy, by design).

create or replace function public.notify_on_comment() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_target uuid;
begin
  if new.parent_id is not null then
    select author_id into v_target from comments where id = new.parent_id;
    if v_target is not null and v_target <> new.author_id then
      insert into notifications (user_id, kind, post_id, comment_id)
      values (v_target, 'comment_reply', new.post_id, new.id);
    end if;
  else
    select author_id into v_target from posts where id = new.post_id;
    if v_target is not null and v_target <> new.author_id then
      insert into notifications (user_id, kind, post_id, comment_id)
      values (v_target, 'post_comment', new.post_id, new.id);
    end if;
  end if;
  return new;
end $$;

revoke execute on function public.notify_on_comment() from public, anon, authenticated;

create trigger comments_notify after insert on public.comments
  for each row execute function public.notify_on_comment();
