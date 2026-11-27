# Configuração do primeiro administrador

A primeira conta administrativa é criada diretamente na tela de acesso da aplicação, sem email e sem comandos manuais na base de dados.

## Criar a conta

1. Abrir a página de acesso da aplicação.
2. Enquanto não existir nenhum administrador, a opção **Criar primeiro administrador** fica disponível.
3. Escolher um nome de utilizador com 3 a 40 caracteres, usando apenas letras, números, ponto, hífen ou underscore.
4. Definir uma palavra-passe com pelo menos 8 caracteres e confirmá-la.
5. Selecionar **Criar administrador e entrar**.

Os nomes de utilizador distinguem maiúsculas e minúsculas. Por exemplo, `MaxiUser` e `maxiuser` são nomes diferentes; no login deve ser usada exactamente a mesma capitalização escolhida no registo. As palavras-passe também distinguem maiúsculas e minúsculas.

A conta recebe automaticamente os cargos de equipa e administrador. Depois da criação, a opção de configuração inicial deixa de ficar disponível e as contas seguintes são geridas por um administrador.

## Segurança

- Não guardar palavras-passe no código, em migrações ou nesta documentação.
- Não ativar registo público de contas.
- A criação do primeiro administrador é validada novamente no servidor e na base de dados, impedindo que outra pessoa use o mesmo atalho depois da configuração inicial.
- Recomenda-se uma palavra-passe forte e exclusiva.

## Atualização da base de dados

Ao atualizar uma instalação existente, aplicar também a migração `0012_case_sensitive_usernames.sql` depois das migrações anteriores. Ela permite nomes de utilizador com letras maiúsculas sem alterar os nomes já guardados.
