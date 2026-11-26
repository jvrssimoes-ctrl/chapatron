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

**No Render (grátis, sempre com o mesmo link):**

1. Suba o projeto para um repositório no GitHub.
2. No [Render](https://render.com), vá em **New → Blueprint**, escolha o repositório e confirme. O `render.yaml` já configura tudo.
3. Em alguns minutos o jogo fica em `https://chapatron-XXXX.onrender.com`. Cada `git push` publica de novo sozinho.

No plano grátis o servidor dorme após 15 min sem ninguém e leva ~1 min pra acordar no primeiro acesso.
Publicar uma versão nova ou o servidor dormir encerra as salas em andamento.

**Com Docker** (qualquer VPS ou hospedagem de containers):

```bash
docker build -t chapatron .
docker run -p 3001:3001 chapatron
```

O container tem verificação de saúde em `/health`. Se a conexão cair, o jogo reconecta sozinho e você volta pra mesma sala e partida (a vaga fica guardada).

## Estrutura

| Pasta | O que tem |
|---|---|
| `shared/` | Tipos, dados das unidades/sinergias/economia, grade hexagonal (usado no cliente e no servidor) |
| `server/` | Servidor autoritativo: salas, loja, economia, bots e simulação de combate determinística |
| `client/src/three/` | Cena 3D (Three.js): tabuleiro hexagonal, robôs 3D procedurais com toon shading, partículas de fumaça, retratos da loja |
| `client/src/` | Replay do combate, HUD em HTML, rede, sons sintetizados |

## Mecânicas (estilo TFT)

- **Papéis**: 🛡️ Tanque, 🥊 Lutador, 🗡️ Assassino (salta na retaguarda), 🏹 Atirador AD, 🔮 Conjurador AP, ✚ Suporte. Atributos vêm do papel + custo; habilidades AD escalam com Dano de Ataque, as outras com Poder de Habilidade.
- **Estágios** 1-2 … 2-1 … 7-x: rodada 7 de cada estágio é PvE (drones soltam orbes de saque que a sua Fumacinha coleta), rodada 4 é o **Carrossel** e rodada 5 é o **Arsenal** (escolha um item), e em **2-1, 3-2, 4-2** você escolhe um **aprimoramento** (prata/ouro/prisma).
- **XP e loja** com a tabela do TFT (nível máx. 10, chances por nível, tamanho do pool).
- **Itens**: 8 componentes → 36 itens completos (`shared/items.ts`). Arraste do banco de itens para um robô; 2 componentes no mesmo robô viram um item. Máx. 3 por robô; vender devolve os itens.
- **Itens especiais**: 🔧 Pé de Cabra (tira todos os itens), 🔨 Reforjador da Quebrada (rerrola os itens) e 📠 Xerox Clandestino (copia um robô de custo até 4). Caem de PvE, Arsenal, Carrossel e Muambeiros.
- **Habilidades únicas**: cada um dos 49 robôs tem sua própria mecânica (saltos, empurrões, invocações, cegueira, provocação, furtividade, reflexo, vírus que espalha, queimaduras, roubo de mana...).
- **Carrossel** (começo do jogo e toda rodada X-4): robôs com itens girando no centro. Clique no chão para andar com a sua **Fumacinha** e encoste no robô que quiser. Quem tem menos vida é liberado primeiro, de 2 em 2.
- **Painel do robô**: clique direito num robô para ver vida, mana, habilidade, sinergias e itens (também durante o combate).
- **Emblemas**: a 🥄 **Colher de Pau** (componente raro) + outro componente vira um Emblema que dá uma sinergia extra ao robô (Fumaceiro, Atirador, Brisado, Cósmico, Enferrujado, Verdinho, Bolado, Laricado). Duas colheres = 👨‍🍳 **Chapéu de Mestre-Cuca**: +1 robô em campo.
- **Visita e dano**: no PvP um time viaja até o tabuleiro do outro (casa/fora). No fim, os robôs que sobraram atiram na Pequena Lenda de quem perdeu, e o dano aparece em cima dela.
- **Pequena Lenda**: escolha espécie (Fumacinha, Cogubolota, Robolinho, Geleca) e cor no menu (🎨). Ela dança quando você manda emote, coleta os orbes de saque e mostra pilhas de moedas no canto (uma por 10 de ouro).
- **Portais**: antes do primeiro carrossel todos votam numa regra especial da partida (Chuva de Grana, Feira Livre, Rodízio de Carrossel, Colchão de Fumaça...).
- **Dicas completas**: passar o mouse num componente mostra todas as combinações (com efeito e atributos; verde = dá pra montar com o que você tem). Itens mostram o que dão ao robô e pra quem são bons. Robôs (em campo, no banco ou na loja) mostram os itens recomendados, e os ícones de item em cima dos robôs também têm dica.
- **Aprimoramentos**: cada opção pode ser trocada uma vez (🔄) e o jogo marca com ⭐ o que combina com seu time. Novos: Blindagem Caseira, Kit Básico, Pancadaria, Colherada, Exército da Brisa (+1 em campo) e Colher Dourada.
- **Arenas**: escolha o cenário no perfil (Ilha da Brisa, Vulcão da Brasa, Geleira Mentolada e outras liberadas por conquistas).
- **★★★ de custo alto**: custo 4 ★★★ vira *Monstro da Brisa* (muito mais vida, dano e mana, recebe menos dano) e custo 5 ★★★ vira *Divindade Chapada* (mana cheia no início, imune a controle, ataques explodem em volta e cada habilidade solta uma onda divina) e ganha a luta em poucos segundos. Teste de força: `npx tsx scripts/star3test.ts`.
- **★★★ épico**: ao fechar um ★★★ sobe um pilar de luz dourada com onda de choque, chuva de faíscas, tremida e banner especial.
- **Modos de jogo** (o anfitrião escolhe no lobby): 🌿 **Normal**; ⚡ **Turbo** (ouro fixo 4/6/9, sem juros, nível sobe sozinho, rolar custa 1, dano ×1.8 e preparação mais curta); 🤝 **Dupla** (2v2, de 4 a 8 jogadores em número par: a dupla divide a vida, luta junta contra outra dupla e pode mandar itens e robôs do banco pro parceiro com botão direito ou pelo painel do robô).
- **Itens Radiantes**: a 🌟 **Forja Radiante** (Arsenal e PvE tardios, aprimoramento prisma) transforma um item completo na versão Radiante: atributos dobrados, +20% de dano e +200 de vida.
- **Artefatos**: 8 itens únicos sem receita (Machado do Lenhador, Cajado Crescente, Armadura Zen, Relógio Parado, Chinelo Voador, Terceiro Olho, Disco Voador e Cogumelo Dourado). Caem no Arsenal e PvE do estágio 4 em diante ou no aprimoramento Baú de Artefatos.
- **Ranque**: cada partida dá ou tira pontos pela colocação (do 🔩 Ferro-Velho ao 👑 Chapado Supremo, divisões IV–I). Fica salvo no navegador e aparece no menu e no perfil, com o histórico mostrando modo e pontos.
- **Tela final**: mostra o ranque ganho/perdido, o seu time final e o time campeão (no modo Dupla, a classificação por dupla).
- **Times recomendados**: aba **Times** no Guia com composições montadas a partir das sinergias, com carregador, tanque e itens sugeridos.
- **Saque em orbes**: nas rodadas contra drones o saque cai como orbes (⚪ comum, 🔵 raro, 🟡 lendário). Clique no tabuleiro para a sua Pequena Lenda ir pegar. Dentro pode vir componente, ⚒️ Bigorna de Componente (escolha 1 de 4), 🛠️ Bigorna Dourada (escolha 1 de 4 itens completos), um robô do custo do estágio ou moedas. O que ficar no chão é recolhido sozinho quando o combate começa.
- **Chefões do PvE**: na rodada 7 de cada estágio (do 2 em diante) aparece um chefão gigante com escolta de drones e habilidade própria: 👑 Rei dos Drones (chama mais drones), 🍞 Torradeira Gigante (torradas que queimam), 🌀 Aspirador Colossal (suga e atordoa), 🔪 Liquidificador Titã (giro em área, fúria com metade da vida) e ❄️ Geladeira Suprema (congela grupos). Antes da luta aparece um aviso com a dica de como enfrentar.
- **Menu novo**: estilo cliente de jogo, com área de jogar, sua Pequena Lenda em 3D (clique para dançar), cartão de carreira (ranque, números e últimas partidas), novidades e dica do dia.
- **Painel de combate**: a aba Dano abre sozinha na luta e mostra dano causado, recebido e cura/escudo de cada robô. Ícones em cima da vida mostram status (💫 atordoado, 🔥 queimando, 🙈 cego, 🔇 calado...).
- **Celular**: dá pra jogar deitado no celular. Arraste com o dedo, toque num item para ver a dica, segure num robô para abrir o painel e segure na loja para ler sem comprar.
- **Ajudas**: ao arrastar um robô o alcance dele aparece no tabuleiro, e as chances de cada custo na loja ficam embaixo do nível.
- **Expansão Laboratório Clandestino**: 13 robôs novos (agora são 62) e 3 sinergias: 🧪 **Mutantes** (crescem a cada 3s de combate), ⚡ **Eletrizados** (raios periódicos que queimam mana) e 🤺 **Duelistas** (ganham velocidade de ataque a cada ataque). Catálogo com todos os robôs em `CHAPATRON-catalogo-robos.pdf` (gerado a partir de `/catalogo.html` no modo dev).
- **Temporadas**: uma por mês, com nome próprio. Na virada os pontos são reiniciados em parte e a melhor marca da temporada fica guardada no perfil.
- **Placar da galera**: o ranque de cada jogador aparece na sala, e o perfil e o menu mostram o placar dos amigos com quem você jogou (quantas partidas juntos e quem ficou na frente).
- **Pequena Lenda personalizada**: 7 espécies (novas: Abacatinho, Cactolino, Polvilho), 7 chapéus, 5 rostos, 6 rastros e 8 emotes extras. Parte vem liberada; o resto sai por conquistas (5 novas) e por ranque.
## Sinergias

- **Verticais** (2/4/6): Verdinhos, Fumaceiros, Laricados, Enferrujados, Cósmicos, Bolados — e Atiradores/Brisados (2/4). Ficam muito fortes quando você fecha tudo.
- **Horizontais** (2/3 ou 2/4, poucas unidades): Sorrateiros, Gurus, DJs do Baile, Hackers, Reciclados, Neons, Paranoicos, Jardineiros (invocam Mudinhas), Muambeiros (saque depois do PvP), Pirados (todo 3º ataque espirra dano) — bônus rápidos pra misturar. Vários robôs têm 3 sinergias.

## Balanceamento

`npm run sim -- 10` simula 10 partidas só com bots e mostra duração dos combates, tabuleiros vencedores, itens e aprimoramentos.

## Atalhos

`1`–`5` comprar da loja · `D` rolar loja · `F` comprar XP · `E` vender robô sob o mouse · `Q` espiar próximo jogador · `Tab` sinergias/dano · `H` guia · `Enter` chat · `Esc` voltar

## Guia, perfil e conquistas

- **Guia da Brisa** (`H` ou 📖): como jogar, todas as sinergias, robôs (com filtros), tabela de receitas de itens e aprimoramentos. Na primeira partida aparecem dicas apontando cada parte da tela.
- **Perfil** (menu → 🏅): partidas, vitórias, colocação média, robôs favoritos, histórico e 13 conquistas. Algumas conquistas liberam **skins de tabuleiro**. Fica salvo no navegador.
- **Emotes** rápidos no chat aparecem ao lado do jogador e grandes sobre o tabuleiro.
