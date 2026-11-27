# Configuração inicial do primeiro administrador

A primeira conta administrativa é criada manualmente no Supabase. Não colocar palavras-passe ou chaves secretas no repositório.

## Pré-requisitos

1. Aplicar a migração `0007_user_profiles_and_admin_policies.sql`.
2. Publicar as Edge Functions `username-login` e `manage-users`.
3. Confirmar que as funções têm acesso às variáveis de ambiente padrão do Supabase, incluindo `SUPABASE_URL`, `SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY`.

## Criar a conta

1. No Supabase Dashboard, abrir **Authentication → Users** e escolher **Add user**.
2. Criar a conta com o email técnico `admin@users.maxi.local`, definir uma palavra-passe forte e confirmar o email.
3. Nos metadados do utilizador, definir:
   ```json
   {
     "username": "admin",
     "display_name": "admin"
   }
   ```
4. Copiar o UUID da conta criada.
5. No **SQL Editor**, executar o SQL abaixo, substituindo o UUID pelo valor real:

   ```sql
   INSERT INTO public.user_profiles (user_id, username)
   VALUES ('UUID_DA_CONTA', 'admin')
   ON CONFLICT (user_id) DO UPDATE SET username = EXCLUDED.username;

   INSERT INTO public.user_roles (user_id, role)
   VALUES ('UUID_DA_CONTA', 'admin')
   ON CONFLICT (user_id, role) DO NOTHING;
   ```

O email técnico é apenas um identificador interno exigido pelo fornecedor de autenticação. O administrador entra na aplicação usando o nome de utilizador **admin** e a palavra-passe definida no primeiro passo.

## Segurança

- Nunca guardar a palavra-passe no GitHub.
- Não activar registo público de contas.
- A função `manage-users` valida a sessão e confirma o papel `admin` antes de criar contas ou alterar permissões.
- O primeiro administrador não pode retirar as próprias permissões nem desactivar a própria conta através desta função.
