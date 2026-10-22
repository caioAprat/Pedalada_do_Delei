# Pedalada do Delei — instruções para o Claude Code

## Quem usa
A dona do projeto é leiga em programação. Sempre responda em português, em linguagem simples,
explicando o que mudou e como testar. O notebook dela tem pouca memória: não proponha nada que
precise instalar programas ou gravar muitos arquivos no computador.

## O que é o app
App web (PWA) para ajustar o saldo de estoque de um produto no ERP, alterando o percentual de
documentos de requisição (REQ). Fluxo em 3 fases:
1. Ficha: a usuária cola as linhas da "ficha de movimentação" do ERP.
2. Saldos: informa o saldo atual e o desejado; aparece uma prévia do plano.
3. Execução: para cada passo, copia o nº do documento e o % e lança no ERP (alterna com Alt+Tab).

## Arquivos
- `index.html` — o app inteiro (HTML, CSS e JavaScript no mesmo arquivo). Não há build, npm nem framework.
- `sw.js` — service worker (funcionar offline e avisar "Nova versão disponível").
- `manifest.json` e `icon.svg` — instalação como aplicativo.
- Publicação: Cloudflare Workers (projeto `pedalada-do-delei`) ligado a este repositório; cada mudança na
  branch principal publica sozinha. `wrangler.jsonc` diz para publicar a pasta como site estático e
  `.assetsignore` tira do site o que não é do app. Não apague esses dois arquivos.

## Regras obrigatórias
- A cada mudança publicada, aumente a versão em DOIS lugares: `const VERSAO` no `index.html`
  e `const VERSAO` no `sw.js`. Os dois devem ser iguais. Sem isso, o aviso de atualização não aparece.
- Não mude os nomes das chaves do localStorage, senão os dados dela somem:
  `pedalada_db_produtos`, `pedalada_db_produtos_bkp`, `pedalada_hist_v3`, `pedalada_sess_v4`, `pedalada_cfg_v1`
  (e o IndexedDB `pedalada`, store `kv`, chaves `db` e `hist` — cópia de segurança dos produtos e do histórico).
- Campos de número são texto com leitura no formato brasileiro (`lerNumero`). Para colocar um número
  num campo por código, use `fmtCampo` (nunca o número cru com ponto, que seria lido como milhar).
- As laterais mostram só informação útil (pendências, gráfico da ficha, painel do dia, calculadora,
  relatórios). Não colocar textos de tutorial ou listas de atalhos nelas.
- Cada produto salvo pode ter `lembrete` ({texto, quando}); `null` quer dizer que foi apagado (não restaurar do IndexedDB).
- Escolher REQ é opcional (`fixo` no documento). Sem nenhuma escolhida, vale a estratégia normal (menos documentos).
- Mantenha tudo em um único `index.html`, sem dependências externas além da fonte do Google.
- Antes de terminar, revise se não há erro de JavaScript e se o fluxo das 3 fases continua funcionando.

## Skills de design (pedido da usuária)
- As skills ficam em `.claude/skills/` (pacote julianromli/ai-skills). Em qualquer mudança de visual
  ou interface, carregue ANTES: `frontend-design`, `ui-ux-pro-max`, `web-design-guidelines`,
  `make-interfaces-feel-better`, `gpt-taste` e `frontend-skill`.
- Siga essas skills sem quebrar as regras acima: tudo continua num único `index.html`, sem React,
  Tailwind, shadcn ou outras dependências (as skills de React/Vercel/Supabase não se aplicam a este app).

## Regras de cálculo (confirmadas pela usuária)
- Estorno de saídas (aumentar o saldo): não pode tirar 100% de um documento. Usa a margem
  configurável (padrão 95%) por documento.
- Adição de saídas (reduzir o saldo): pode adicionar qualquer quantidade num documento, desde que o
  saldo da ficha nunca fique negativo. O limite de cada REQ é o MENOR saldo da ficha daquela linha
  em diante (coluna SALDO). Ao usar várias REQs, o app desconta o que já foi alocado (regra conservadora).
- O percentual sempre tem 4 casas decimais, arredondado (nunca truncado). Ex.: 58,3333.
- Estratégia padrão: menos documentos possível. Opcionais: mais antigos, mais recentes,
  deixar REQs já usadas por último, ignorar um período.

## Formato da ficha colada (exemplo real)
```
PRODUTO :11070016 CHAPA ALUMINIO 2000 X 1000 X 1.5 MM - PESO DA CHAPA 8,136 KG UNIDADE:KG FATOR: 1,0000 38,2476 958,88 SALDO ANTERIOR 1 2 TRE 824009 01/09/26 81,0000 25,07046 2.030,71 119,2476 REQUISIÇÃO: 166957 1 2 REQ 493974 03/09/26 4,4200 25,07046 110,81 114,8276 OP 444700
```
Cada movimento: TIPO NÚMERO DATA QUANTIDADE CUSTO VALOR SALDO. Números no formato brasileiro
(1.234,5678). Só as linhas REQ podem ser ajustadas; as outras (TRE etc.) entram no cálculo do saldo.
