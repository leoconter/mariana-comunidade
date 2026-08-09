-- 0006_password_emails: the community signs in with e-mail + password, so
-- accounts provisioned by the Kirvano webhook (which have no password) must
-- receive a link to create one.

insert into public.email_templates (key, subject, body_html) values
  ('password_setup', 'Crie sua senha de acesso',
   '<p>Olá, {{nome}}!</p><p>Para entrar na comunidade, crie sua senha de acesso pelo link abaixo:</p><p><a href="{{url_senha}}">Criar minha senha</a></p><p>O link vale por 1 hora. Se você não pediu isso, pode ignorar este e-mail.</p>')
on conflict (key) do nothing;

update public.email_templates
set body_html = '<p>Olá, {{nome}}!</p><p>Sua assinatura está ativa e a comunidade já está aberta para você.</p><p>O primeiro passo é criar sua senha de acesso:</p><p><a href="{{url}}">Criar minha senha e entrar</a></p><p>Depois disso, comece pelo espaço <strong>🆕 Comece aqui</strong> — em poucos minutos você entende como aproveitar tudo.</p><p>Nos vemos lá!<br>Mariana</p>'
where key = 'welcome';
