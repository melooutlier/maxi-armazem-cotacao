# Plano: Maxi Armazém — Gestão de Vistorias

## Experiência
- Substituir a tela inicial de demonstração por um espaço de trabalho responsivo com três modos: Campo, Escritório e Histórico & Relatórios.
- Em Campo, permitir selecionar supermercado e operador, buscar produtos por código ou nome, escolher quantidade/prioridade, revisar itens e concluir a vistoria com código único.
- Em Escritório, selecionar visitas pendentes, copiar uma linha ou a lista tabulada, marcar itens lançados, exportar CSV e imprimir guia de separação.
- Em Histórico & Relatórios, filtrar visitas por data e supermercado e mostrar os indicadores e produtos mais solicitados.
- Usar catálogo inicial realista de Maputo, botões adequados a toque e a paleta azul-marinho, cinza e verde indicada no briefing.

## Persistência e validação
- Usar Lovable Cloud para que vistorias concluídas e o progresso de lançamento permaneçam disponíveis entre dispositivos e sessões.
- Incluir validação das regras de conclusão e dos estados de lançamento; conferir o fluxo de vistoria até o painel do escritório e o histórico.
- Definir título e descrições próprios para a página inicial.

## Detalhes técnicos
- Manter a navegação em uma única página com modos selecionáveis, seguindo TanStack Start e os componentes/tokens existentes.
- Criar armazenamento para visitas e itens com acesso protegido por políticas; manter o catálogo de demonstração na aplicação.
- Gerar o código da vistoria ao concluir e fornecer CSV, cópia para área de transferência e impressão a partir dos dados salvos.
