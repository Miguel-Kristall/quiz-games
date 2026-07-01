# Melhorias focadas no quiz

Escopo enxuto: 3 melhorias combinadas que se reforçam.

## 1. Mais profundidade no quiz (2 perguntas novas)

Adicionar em `QUESTIONS` (src/routes/index.tsx):

- **Nível de desafio preferido** (single): Tranquilo · Equilibrado · Punitivo
- **O que mais te prende num jogo?** (single): História · Gameplay · Mundo aberto · Progressão/loot

Essas respostas vão para o prompt em `recommend.functions.ts` como `challenge` e `hook`, tornando as recomendações mais personalizadas.

## 2. Resultados mais ricos

Ampliar o `Recommendation` (server) para incluir:

- `ano` (número) — ano de lançamento
- `nota` (0–10) — nota estimada da comunidade
- `porqueVoceVaiGostar` (string curta) — 1 frase conectada ao perfil, separada da `descricao`
- `destaques` (array de 2–3 tags curtas: ex. "Trilha sonora incrível", "Combate satisfatório")
- `linkYoutube` — busca de trailer: `https://www.youtube.com/results?search_query=NOME+trailer`

No `GameCard`:
- Header com nome + ano + badge de nota (cor por faixa)
- Chips de "destaques" acima da descrição
- Bloco destacado "Por que você vai gostar" com ícone Sparkles
- Botões: "Ver na Steam" + "Ver trailer" (YouTube, ghost) + dismiss (X)

Não adicionamos capa de jogo (exigiria API externa de imagens — fora do escopo enxuto).

## 3. Refinamento pós-resultado

Na tela de resultados, adicionar barra de ações:

- **Feedback por card**: além do X (não me interessa), botão 👍 "mais como este". Ao clicar, o nome vai para uma lista `likedNames` que entra no prompt como "o usuário adorou estes — traga jogos com vibe parecida".
- **Filtro rápido de plataforma** (chips no topo dos resultados): filtra client-side a lista atual sem nova chamada.
- **Botão "Mais parecidos"** ao lado de "Gerar outras": usa `likedNames` + exclui todos já mostrados.

## Detalhes técnicos

**`src/lib/recommend.functions.ts`**
- Adicionar campos ao `RecommendInput`: `challenge`, `hook`, `liked: string[]`
- Adicionar ao `Recommendation`: `ano`, `nota`, `porqueVoceVaiGostar`, `destaques`, `linkYoutube`
- Atualizar `buildPrompt` com labels novos, seção "Jogos que adorou (traga vibes parecidas)", e novo formato JSON de exemplo com os campos extras
- Manter `max_tokens: 2048` (subir para 3000 se necessário)
- Manter parsing por regex `/\[[\s\S]*\]/`

**`src/routes/index.tsx`**
- Duas entradas novas no array `QUESTIONS` (progress bar cresce automaticamente)
- Novo state: `likedNames: string[]`
- Nova função `likeOne(name)` — adiciona a likedNames sem remover da tela
- `runRecommend` passa `challenge`, `hook`, `liked: likedNames`
- Novo filtro `platformFilter` client-side na tela de resultados
- `GameCard` recebe callbacks `onLike`, `onDismiss` e renderiza os novos campos
- Botão "Mais parecidos" só habilitado se `likedNames.length > 0`

## Fora de escopo (decisão consciente)

- Capas de jogos, Metacritic real, salvar no localStorage, atalhos de teclado, comparar lado a lado — ficam para uma próxima rodada se você quiser.
