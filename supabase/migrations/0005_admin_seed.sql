-- 0005_admin_seed: Mariana's admin email.
-- Any auth user created with this email is promoted to admin by
-- handle_new_user() and gets lifetime access, regardless of Kirvano.

insert into public.admin_emails (email) values ('vsemcolica@gmail.com')
on conflict (email) do nothing;
