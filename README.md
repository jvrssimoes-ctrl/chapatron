# 🌿 CHAPATRON — auto-batalha de robôs na brisa

Auto-battler multiplayer no navegador (até 8 jogadores, com bots). Robôs sci-fi chapados, sinergias, loja, evolução por estrelas e combate automático.

## Rodar local (desenvolvimento)

```bash
npm install
npm run dev
```

Abra http://localhost:5173 → **Criar sala** → adicione bots → **Começar partida**.

- Servidor do jogo (Node + WebSocket): porta 3001
- Cliente (Vite): porta 5173, faz proxy do `/ws` para o servidor

## Jogar com amigos

**Mesma rede (Wi‑Fi de casa):** rode `npm run dev` e mande pros amigos o endereço "Network" que o Vite mostra (ex.: `http://192.168.0.10:5173/?sala=ABCD`).

**Pela internet:** faça o build e rode um único servidor que serve o jogo e o WebSocket na mesma porta:

```bash
npm run build
npm start
```

Ele usa a variável `PORT` (padrão 3001), então funciona direto em hospedagens Node como Render, Railway ou Fly.io
(comando de build: `npm install && npm run build`, comando de start: `npm start`).

## Estrutura

| Pasta | O que tem |
|---|---|
| `shared/` | Tipos, dados das unidades/sinergias/economia, grade hexagonal (usado no cliente e no servidor) |
| `server/` | Servidor autoritativo: salas, loja, economia, bots e simulação de combate determinística |
| `client/src/three/` | Cena 3D (Three.js): tabuleiro hexagonal, robôs 3D procedurais com toon shading, partículas de fumaça, retratos da loja |
| `client/src/` | Replay do combate, HUD em HTML, rede, sons sintetizados |

## Mecânicas (estilo TFT)

- **Papéis**: 🛡️ Tanque, 🥊 Lutador, 🗡️ Assassino (salta na retaguarda), 🏹 Atirador AD, 🔮 Conjurador AP, ✚ Suporte. Atributos vêm do papel + custo; habilidades AD escalam com Dano de Ataque, as outras com Poder de Habilidade.
- **Estágios** 1-2 … 2-1 … 7-x: rodada 7 de cada estágio é PvE (drones soltam itens), rodada 4 é o **Arsenal** (escolha um item), e em **2-1, 3-2, 4-2** você escolhe um **aprimoramento** (prata/ouro/prisma).
- **XP e loja** com a tabela do TFT (nível máx. 10, chances por nível, tamanho do pool).
- **Itens**: 8 componentes → 36 itens completos (`shared/items.ts`). Arraste do banco de itens para um robô; 2 componentes no mesmo robô viram um item. Máx. 3 por robô; vender devolve os itens.

## Sinergias

- **Verticais** (2/4/6): Verdinhos, Fumaceiros, Laricados, Enferrujados, Cósmicos, Bolados — e Atiradores/Brisados (2/4). Ficam muito fortes quando você fecha tudo.
- **Horizontais** (2/3 ou 2/4, poucas unidades): Sorrateiros, Gurus, DJs do Baile, Hackers, Reciclados — bônus rápidos pra misturar. Vários robôs têm 3 sinergias.

## Balanceamento

`npm run sim -- 10` simula 10 partidas só com bots e mostra duração dos combates, tabuleiros vencedores, itens e aprimoramentos.

## Atalhos

`D` rolar loja · `F` comprar XP · `E` vender robô sob o mouse · `Enter` chat · `Esc` parar de espiar
