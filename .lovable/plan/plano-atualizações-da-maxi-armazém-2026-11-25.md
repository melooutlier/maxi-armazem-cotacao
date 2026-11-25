# Plano: Atualizações da Maxi Armazém

## Experiência
- Criar entrada com login; após autenticação, mostrar o nome do utilizador e três cartões principais lado a lado: Campo, Escritório e Histórico.
- No modo Campo, selecionar ou cadastrar uma empresa antes de iniciar a vistoria. Colocar a busca de produtos acima da lista, mostrando saldo disponível e nível baixo, médio ou alto com limites configuráveis por produto.
- Tornar a prioridade opcional; permitir desconto percentual por produto e aplicar um mesmo desconto à lista inteira.
- Pedir confirmação antes de concluir; depois da conclusão, voltar ao menu dos três cartões.
- No Escritório, copiar para as 12 colunas do ERP na ordem indicada, preenchendo somente Artigo, Desconto e Qtd com os dados disponíveis. Manter cópia por linha e da lista completa.
- Preservar o histórico e os indicadores, usando a economia estimada de 20 minutos por vistoria concluída.

## Acesso e dados
- Usar Lovable Cloud para login e persistência. Guardar nome de apresentação e, opcionalmente, avatar em `profiles`; manter cargos exclusivamente em `user_roles`.
- Restringir vistorias, empresas, catálogo e stock a contas autenticadas com cargo atribuído. Não abrir cadastro público por padrão.
- Criar cadastro de empresas e catálogo persistente, conservar registos antigos e preparar campos para stock e limites individuais.
- Não exibir quantidades fictícias como stock real. O saldo será ligado ao ERP identificado; os limites por produto podem ser definidos no sistema.

## Integração e validação
- Ligar a consulta de stock ao ERP escolhido usando uma conexão segura no servidor. A ligação está pendente do nome do ERP e da disponibilidade do respetivo acesso.
- Testar login, permissões, cadastro de empresas, stock por limites próprios, descontos percentuais, confirmação, cópia tabulada e histórico.
- Atualizar metadados, rever os avisos de segurança e validar a experiência em tablet e computador.

## Detalhes técnicos
- Manter TanStack Start; usar rotas protegidas para a área autenticada e funções de servidor autenticadas para chamadas externas.
- Criar `profiles` com referência a `auth.users`; atribuir cargos em tabela separada e aplicar RLS por cargo, sem confiar em metadados editáveis pelo utilizador.
- Aplicar alterações de base de dados por migrações aditivas, com GRANTs explícitos e políticas para utilizadores autenticados.