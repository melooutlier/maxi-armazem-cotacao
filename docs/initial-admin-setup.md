# Configuração inicial do primeiro administrador

A primeira conta administrativa é criada manualmente no Supabase. Não colocar palavras-passe, tokens ou chaves secretas no repositório.

## Conta inicial definida

- Nome de utilizador: `zeid`
- Perfil: Administrador
- Palavra-passe: definir directamente no Supabase Authentication durante a criação da conta, usando a credencial fornecida pelo responsável do projecto. Não a copiar para este documento, SQL, GitHub ou logs.

## Pré-requisitos

1. Aplicar as migrações `0007_user_profiles_and_admin_policies.sql` e `0008_orders_products_and_daily_routes.sql`, por esta ordem.
2. Publicar as Edge Functions `username-login` e `manage-users` (incluindo a acção `list` para o painel de utilizadores).
3. Confirmar que as funções têm acesso às variáveis de ambiente padrão do Supabase, incluindo `SUPABASE_URL`, `SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY`.

## Criar a conta zeid

1. No Supabase Dashboard, abrir **Authentication → Users** e escolher **Add user**.
2. Criar a conta com:
   - Email técnico: `zeid@users.maxi.local`
   - Password: introduzir a palavra-passe inicial fornecida pelo responsável do projecto directamente no formulário do Supabase.
   - Confirmar/activar a conta, se essa opção for apresentada.
3. Nos metadados do utilizador, definir:
   ```json
   {
     "username": "zeid",
     "display_name": "zeid"
   }
   ```
4. Guardar a conta e copiar o UUID do utilizador criado.
5. No **SQL Editor**, executar o SQL abaixo, substituindo `UUID_DA_CONTA` pelo UUID real:

   ```sql
   INSERT INTO public.user_profiles (user_id, username)
   VALUES ('UUID_DA_CONTA', 'zeid')
   ON CONFLICT (user_id) DO UPDATE SET username = EXCLUDED.username;

   INSERT INTO public.user_roles (user_id, role)
   VALUES ('UUID_DA_CONTA', 'admin')
   ON CONFLICT (user_id, role) DO NOTHING;
   ```

6. Confirmar que a conta aparece em **Authentication → Users** e que o utilizador tem o papel `admin` em `public.user_roles`.
7. Testar o login na aplicação usando o nome de utilizador `zeid` e a palavra-passe definida no passo 2.

O email técnico é apenas um identificador interno exigido pelo fornecedor de autenticação. O administrador entra na aplicação usando o nome de utilizador **zeid**, nunca o email técnico.

## Segurança

- Nunca guardar a palavra-passe no GitHub, código-fonte, SQL versionado ou documentação.
- Não activar registo público de contas.
- Recomenda-se alterar a palavra-passe inicial após o primeiro acesso e usar uma credencial forte e exclusiva.
- A função `manage-users` valida a sessão e confirma o papel `admin` antes de criar contas ou alterar permissões.
- O primeiro administrador não pode retirar as próprias permissões nem desactivar a própria conta através desta função.
