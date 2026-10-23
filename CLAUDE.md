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
- `manifest.json`, `icon.svg`, `icon-192.png`, `icon-512.png`, `apple-touch-icon.png` — instalação como aplicativo. O ícone
  (v6.0.1) é a roda de bicicleta âmbar em linhas, com fundo TRANSPARENTE (pedido da usuária). Os PNGs saem do `icon.svg`
  (renderizados com fundo transparente); se mudar o SVG, gere os PNGs de novo.
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
- Se o ERP recusar um ajuste ("Estoque insuficiente para ajustar requisição"), o registro vira
  `conferencia.tipo === 'recusado'` (status "Recusado pelo ERP"). Não conta como peça movimentada, como
  diferença de saldo nem como REQ usada. Enquanto não for resolvido, `limitesRecusados` limita a próxima
  tentativa nas mesmas REQs (de 1 em 1 peça, ou pela metade se a quantidade não for inteira).
- Mantenha tudo em um único `index.html`, sem dependências externas além da fonte do Google.
  **Exceções (aprovadas pela usuária):** (1) a partir da v6.0.0 o visual usa GSAP e three.js em `vendor/` e `fx/` (ver "Movimento e fundo vivo" abaixo); (2) o susto escondido do botão do Bruno (v5.3.0/5.4.0) usa `vendor/three.min.js`
  (three.js enxuto: corredor 3D e efeitos de imagem), `vendor/gsap.min.js` + plugins do GSAP (`SplitText`,
  `ScrambleTextPlugin`, `CustomWiggle`, `CustomEase`, `EasePack`), `susto/cena.js` (fases, textos, sons) e
  `susto/menina.js` (a menina pintada em 2D por código, em 5 poses). Esses arquivos só são baixados quando ela passa
  o mouse/clica no botão (`prepararSusto()`); o resto do app não depende deles. Os plugins do GSAP são opcionais
  (se algum não carregar, o susto roda sem ele). Sem WebGL ou com "reduzir movimento", `rodar()` cai numa cena final
  2D (`cenaFinal2D`); se a própria `rodar()` falhar, `brunoSusto()` usa a versão simples (`sustoSimples`).
  Não coloque `vendor/` nem `susto/` no `.assetsignore` e não adicione outras bibliotecas.
- Susto do Bruno (3 tempos): 1) o app dela escurece/treme e uma figura 2D aparece mais perto a cada piscada (o título
  vira "Bruno" e é restaurado ao fechar); 2) apagão, corredor escuro, o mouse é a lanterna (máscara no shader) e ela só
  anda quando a luz sai de cima dela, com autopiloto para quem não mexe o mouse; 3) susto, corte, "TE PEGUEI, BRUNO!".
  Depois de fechar, um "eco" (vulto rápido no canto, uma vez só, nunca na fase 3 nem com janela aberta).
  Segurança primeiro: no máximo um clarão forte e uma piscada preta por vez (mais de 1 s entre elas), respeita
  `prefers-reduced-motion` (modo calmo, sem piscadas), `config.sons`/`config.volume` e Modo Leve; Esc sempre fecha e
  restaura o app (classe `susto-corrompe`, título); libere os recursos do WebGL ao fechar. Sons reais opcionais:
  `susto/sons/<nome>.mp3` (ver `LEIA-ME.txt`) tomam o lugar dos sintetizados; créditos em `susto/sons/CREDITOS.txt`.
  Para regenerar `vendor/three.min.js`, empacote só as classes usadas com esbuild (tree-shaking) a partir do npm `three`.
- Antes de terminar, revise se não há erro de JavaScript e se o fluxo das 3 fases continua funcionando.

## Skills de design (pedido da usuária)
- As skills ficam em `.claude/skills/` (pacote julianromli/ai-skills). Em qualquer mudança de visual
  ou interface, carregue ANTES: `frontend-design`, `ui-ux-pro-max`, `web-design-guidelines`,
  `make-interfaces-feel-better`, `gpt-taste` e `frontend-skill`.
- Siga essas skills sem quebrar as regras acima: tudo continua num único `index.html`, sem React,
  Tailwind, shadcn ou outras dependências (as skills de React/Vercel/Supabase não se aplicam a este app).
- Direção visual atual (v6.0.0, pedido da usuária após ler o Jarvão): "oficina à noite". Preto quente (#080706),
  UMA cor de destaque (âmbar #ff9a4d; verde/azul/rosa são opções nas Configurações), fontes Saira (textos), JetBrains Mono
  (números e rótulos) e Michroma (só o nome do app), as mesmas do Jarvão. SEM cartões: seções separadas por fios finos,
  números enormes, botão principal é um retângulo âmbar e o resto é texto com fio embaixo, cantos quase retos, sem
  gradiente em texto, sem ícones em quadradinhos, sem pílulas. Mantenha essa linha; evite os "queridinhos" de IA
  (roxo/índigo, caixas arredondadas com sombra, badges em pílula, brilho neon).
- Movimento e fundo vivo (v6): `fx/movimento.js` (GSAP + ScrollTrigger/SplitText/ScrambleText/CustomEase; letras que
  sobem, dígitos que giram, contadores, faíscas ao copiar, rolagem) e `fx/vivo.js` (three.js: roda de bicicleta em linhas
  e faíscas, que avança a cada passo e gira inteira quando o ajuste termina). O app chama `fx('evento', ...)`; qualquer
  falha é ignorada. Nada disso roda com Modo Leve ou "reduzir movimento"; o `vivo.js` só carrega depois que o app abriu
  (`iniciarVivo()`), usa poucas partículas e pausa em outra aba/janela ou durante o susto. O app tem que funcionar igual
  sem esses arquivos.

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
