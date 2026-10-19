# CruelMarket: modelagem UML

Simulador de bolsa multiplayer com a temática de Cruelty Squad. Os diagramas estão em Mermaid, que o GitHub renderiza direto no repositório. Sugestão de local: `docs/uml/diagramas-uml.md`.

Premissas **(A)** a confirmar pelo grupo: apenas ordens limitadas (com preço), tecnologias de banco e de mensageria ainda por definir, e falência modelada como status do ativo, não como perfil de preço.

## 1. Casos de uso

Atores e funcionalidades do sistema. Cobre R1 a R5, R10, R11 e as seções 5, 7.4, 8 e 9 do enunciado.

```mermaid
flowchart LR
  Investidor(["Investidor (jogador)"])
  Admin(["Administrador"])
  NPC(["Agente NPC"])
  Relogio(["Relógio de mercado"])

  subgraph Sistema["CruelMarket"]
    UC1([Cadastrar e autenticar])
    UC2([Entrar e sair do mercado])
    UC3([Consultar ativos, preços e livro de ofertas])
    UC4([Enviar ordem de compra])
    UC5([Enviar ordem de venda])
    UC20([Validar saldo ou quantidade])
    UC6([Cancelar ordem própria])
    UC7([Consultar status da ordem])
    UC8([Consultar carteira e patrimônio])
    UC9([Consultar histórico de negociações])
    UC10([Ver ranking de investidores])
    UC11([Receber atualizações em tempo real])
    UC12([Reconectar e recuperar estado])
    UC13([Reiniciar o mercado])
    UC14([Disparar evento manualmente])
    UC15([Consultar métricas e logs])
    UC16([Enviar ordens automáticas])
    UC17([Gerar ticks de preço])
    UC18([Sortear e aplicar eventos])
    UC19([Agendar e executar a falência])
  end

  Investidor --- UC1
  Investidor --- UC2
  Investidor --- UC3
  Investidor --- UC4
  Investidor --- UC5
  Investidor --- UC6
  Investidor --- UC7
  Investidor --- UC8
  Investidor --- UC9
  Investidor --- UC10
  Investidor --- UC11
  Investidor --- UC12

  Admin --- UC13
  Admin --- UC14
  Admin --- UC15

  NPC --- UC16

  Relogio --- UC17
  Relogio --- UC18
  Relogio --- UC19

  UC4 -.->|"«include»"| UC20
  UC5 -.->|"«include»"| UC20
  UC16 -.->|"«include»"| UC20
  UC12 -.->|"«extend»"| UC11
```

## 2. Componentes e arquitetura

Serviços, fluxo de mensagens e infraestrutura. Cobre R6 a R9, R13 e R14 e a seção 7.1. O Matching Engine tem um escritor único por ticker, o que ordena as ordens sem travas distribuídas (7.3).

```mermaid
flowchart TB
  subgraph Clientes
    HB["Home Broker (web)"]
  end

  subgraph Borda["Borda"]
    GW["API Gateway e WebSocket"]
    AUTH["Autenticação e sessões"]
  end

  subgraph Servicos["Serviços de domínio"]
    ORD["Serviço de Ordens"]
    ME["Matching Engine<br/>escritor único por ticker"]
    LED["Carteira e Ledger"]
    MKT["Serviço de Mercado<br/>relógio e preço de referência"]
    EVT["Gerador de Eventos e Falência"]
    NPC["Agentes NPC"]
    RNK["Ranking"]
  end

  subgraph Infra["Infraestrutura"]
    BUS[("Broker de mensagens<br/>a definir")]
    DB[("Banco de dados<br/>a definir")]
    OBS["Observabilidade<br/>logs e métricas"]
  end

  HB <-->|"REST e WebSocket"| GW
  GW -->|"valida token"| AUTH
  GW -->|"ordens"| ORD
  ORD -->|"reserva saldo ou ativos"| LED
  ORD -->|"ordem validada, por ticker"| ME
  ME -->|"liquida negociação"| LED
  ME -->|"livro e negociações"| BUS
  MKT -->|"preço de referência"| BUS
  EVT -->|"eventos e falência"| BUS
  EVT -->|"aplica efeito no preço"| MKT
  EVT -->|"cancela ordens do ativo falido"| ME
  NPC -->|"ordens automáticas"| ORD
  RNK -->|"lê patrimônio"| LED
  BUS -->|"push em tempo real"| GW

  AUTH --> DB
  ORD --> DB
  LED --> DB
  MKT --> DB
  EVT --> DB
  RNK --> DB
  Servicos -.->|"logs e métricas"| OBS
```

## 3. Implantação

Contêineres e redes (R15 e seção 7.1). Réplicas, balanceamento e cluster entram como diferencial.

```mermaid
flowchart LR
  Usuario(["Navegador do jogador"])

  subgraph Host["docker compose ou cluster"]
    subgraph Publica["Rede pública"]
      FE["contêiner: frontend"]
      GW["contêiner: gateway<br/>réplicas opcionais"]
    end
    subgraph Interna["Rede interna"]
      AUTH["contêiner: auth"]
      ORD["contêiner: ordens"]
      ME["contêiner: matching-engine"]
      LED["contêiner: carteira"]
      MKT["contêiner: mercado"]
      EVT["contêiner: eventos"]
      NPC["contêiner: npcs"]
      BUS[("contêiner: broker de mensagens")]
      DB[("contêiner: banco de dados<br/>volume persistente")]
      OBS["contêiner: logs e métricas"]
    end
  end

  Usuario -->|"HTTPS e WebSocket"| FE
  Usuario -->|"HTTPS e WebSocket"| GW
  GW --> AUTH
  GW --> ORD
  GW --> BUS
  ORD --> ME
  ORD --> LED
  ME --> LED
  ME --> BUS
  MKT --> BUS
  EVT --> BUS
  NPC --> ORD
  AUTH --> DB
  LED --> DB
  MKT --> DB
  EVT --> DB
  ORD --> DB
  Interna -.-> OBS
```

## 4. Classes de domínio

Modelo de domínio com as regras do jogo (ativos com perfil de preço, eventos, falência com GAME OVER). Cobre R4 a R7 e as seções 8 e 9. A falência é o status `FALIDO` do ativo, com `mensagemGameOver` fixa por ativo.

```mermaid
classDiagram
  class Investidor {
    +UUID id
    +String nome
    +String email
    +String senhaHash
    +Decimal saldoDisponivel
    +Decimal saldoReservado
    +Boolean ehNpc
    +patrimonio() Decimal
  }
  class Sessao {
    +String token
    +UUID investidorId
    +DateTime criadaEm
    +DateTime expiraEm
    +DateTime ultimoHeartbeat
    +Boolean ativa
  }
  class Ativo {
    +String ticker
    +String nome
    +Categoria categoria
    +PerfilPreco perfil
    +Decimal piso
    +Decimal teto
    +Decimal precoReferencia
    +Decimal ultimoPreco
    +StatusAtivo status
    +Boolean podeFalir
    +String mensagemGameOver
    +falir() void
  }
  class Categoria {
    <<enumeration>>
    ACAO
    PECA
    PEIXE
  }
  class PerfilPreco {
    <<enumeration>>
    BLUECHIP
    CICLO
    RANDOM_WALK
    FIXO
  }
  class StatusAtivo {
    <<enumeration>>
    ATIVO
    FALIDO
  }
  class Ordem {
    +UUID id
    +UUID investidorId
    +String ticker
    +LadoOrdem lado
    +Decimal precoLimite
    +Int quantidade
    +Int quantidadeExecutada
    +StatusOrdem status
    +DateTime criadaEm
    +Long sequencia
  }
  class LadoOrdem {
    <<enumeration>>
    COMPRA
    VENDA
  }
  class StatusOrdem {
    <<enumeration>>
    RECEBIDA
    REJEITADA
    ABERTA
    PARCIALMENTE_EXECUTADA
    EXECUTADA
    CANCELADA
  }
  class Negociacao {
    +UUID id
    +String ticker
    +UUID ordemCompraId
    +UUID ordemVendaId
    +Int quantidade
    +Decimal preco
    +DateTime executadaEm
    +Long sequencia
  }
  class Posicao {
    +UUID investidorId
    +String ticker
    +Int quantidade
    +Int quantidadeReservada
    +Decimal precoMedio
    +lucroPrejuizo(Decimal precoAtual) Decimal
  }
  class LivroOfertas {
    +String ticker
    -List~Ordem~ compras
    -List~Ordem~ vendas
    +inserir(Ordem ordem) void
    +remover(UUID ordemId) void
    +melhorCompra() Ordem
    +melhorVenda() Ordem
  }
  class MatchingEngine {
    +processar(Ordem ordem) List~Negociacao~
    +cancelarOrdensDoAtivo(String ticker) void
  }
  class EventoMercado {
    +UUID id
    +TipoEvento tipo
    +String ticker
    +DateTime anunciadoEm
    +DateTime inicio
    +DateTime fim
  }
  class TipoEvento {
    <<enumeration>>
    FRENZY
    SHORT_SQUEEZE
    CRASH
    DEMANDA_ALTA
    DEMANDA_BAIXA
    FALENCIA_FATAL
  }
  class FalenciaAgendada {
    +String ticker
    +DateTime agendadaPara
    +DateTime executadaEm
    +Long seed
  }
  class AgenteNPC {
    +UUID id
    +UUID investidorId
    +PerfilNPC perfil
    +decidir(Ativo ativo) Ordem
  }
  class PerfilNPC {
    <<enumeration>>
    CICLISTA
    ALEATORIO
    CONSERVADOR
  }
  class RegistroOperacao {
    +UUID id
    +UUID ordemId
    +String etapa
    +DateTime momento
    +String detalhe
  }

  Investidor "1" --> "0..*" Sessao : possui
  Investidor "1" --> "0..*" Ordem : envia
  Investidor "1" --> "0..*" Posicao : detém
  Ativo "1" --> "0..*" Posicao : é detido em
  Ativo "1" --> "1" LivroOfertas : tem
  LivroOfertas "1" o-- "0..*" Ordem : contém abertas
  Ordem "1" --> "0..*" Negociacao : gera
  Ordem "1" --> "0..*" RegistroOperacao : rastreada por
  MatchingEngine --> LivroOfertas : usa
  MatchingEngine ..> Negociacao : produz
  EventoMercado "0..*" --> "0..1" Ativo : afeta
  FalenciaAgendada "0..1" --> "1" Ativo : alvo
  AgenteNPC "1" --> "1" Investidor : opera como
  Ativo --> Categoria
  Ativo --> PerfilPreco
  Ativo --> StatusAtivo
  Ordem --> LadoOrdem
  Ordem --> StatusOrdem
  EventoMercado --> TipoEvento
  AgenteNPC --> PerfilNPC
```

## 5. Sequência: envio e execução de uma ordem

Fluxo observável da seção 7.8 (`ORDER_RECEIVED` até `CLIENTS_NOTIFIED`). A reserva de saldo ou de ativos impede uso duplo em ordens concorrentes (7.3). A liquidação é uma única transação atômica.

```mermaid
sequenceDiagram
  autonumber
  actor Inv as Investidor
  participant HB as Home Broker
  participant GW as Gateway
  participant AU as Autenticação
  participant OR as Serviço de Ordens
  participant LE as Carteira (Ledger)
  participant ME as Matching Engine
  participant BUS as Broker de mensagens
  participant DB as Banco de dados

  Inv->>HB: preenche ordem com ticker, lado, quantidade e preço limite
  HB->>GW: POST /ordens com token
  GW->>AU: valida sessão
  AU-->>GW: sessão válida
  GW->>OR: ORDER_RECEIVED
  OR->>OR: valida parâmetros e status ATIVO do ativo (ORDER_VALIDATED)
  OR->>LE: reservar saldo (compra) ou ativos (venda)
  alt saldo ou quantidade insuficiente
    LE-->>OR: reserva negada
    OR-->>GW: ordem REJEITADA
    GW-->>HB: erro com o motivo
  else reserva concedida
    LE-->>OR: reserva confirmada
    OR->>ME: enfileira na partição do ticker
    ME->>ME: insere no livro (ORDER_BOOK_INSERTED) e busca contraparte (MATCH_FOUND)
    opt existe ordem compatível
      ME->>LE: liquidar negociação (TRADE_EXECUTED)
      LE->>DB: transação atômica com saldos, posições, ordens e negociação
      DB-->>LE: commit
      LE-->>ME: liquidação confirmada (PORTFOLIO_UPDATED)
    end
    ME->>BUS: publica livro atualizado e negociações
    BUS-->>GW: eventos
    GW-->>HB: push por WebSocket (CLIENTS_NOTIFIED)
  end
```

## 6. Sequência: evento aleatório e falência

Eventos sorteados com briefing antecipado e a falência única agendada, com GAME OVER no label. O agendamento é persistido para não se repetir após uma queda (RNF10).

```mermaid
sequenceDiagram
  autonumber
  participant CLK as Relógio de mercado
  participant EV as Gerador de Eventos
  participant MK as Serviço de Mercado
  participant ME as Matching Engine
  participant LE as Carteira (Ledger)
  participant DB as Banco de dados
  participant BUS as Broker de mensagens
  participant GW as Gateway
  participant HB as Home Broker

  Note over CLK,MK: tick de 1 s atualiza o preço de referência
  CLK->>MK: tick
  MK->>BUS: PRECO_REFERENCIA
  BUS-->>GW: preço
  GW-->>HB: atualiza gráfico

  Note over EV: sorteio a cada 45 a 90 s com seed configurável
  EV->>BUS: EVENTO_ANUNCIADO (briefing 5 s antes)
  BUS-->>GW: briefing
  GW-->>HB: exibe anúncio do evento
  EV->>MK: aplica efeito (FRENZY, CRASH, DEMANDA_ALTA ...)
  MK->>DB: persiste estado do mercado

  Note over EV: falência agendada uma única vez, entre 2 e 5 min
  EV->>DB: lê agendamento da falência
  EV->>MK: marcar ativo como FALIDO
  MK->>DB: grava status FALIDO (transação)
  MK->>ME: cancelar ordens abertas do ativo
  ME->>LE: devolver reservas e zerar posições
  LE->>DB: transação atômica
  MK->>BUS: ATIVO_FALIDO
  BUS-->>GW: evento
  GW-->>HB: label GAME OVER com a frase da empresa
```

## 7. Sequência: falha controlada e recuperação

Demonstração obrigatória da seção 15: o serviço de mercado é derrubado, o sistema detecta, reage e recupera o estado, e o cliente reconecta. Cobre R11, 7.5, RNF09 e RNF10. O circuit breaker é um diferencial.

```mermaid
sequenceDiagram
  autonumber
  participant HB as Home Broker
  participant GW as Gateway
  participant MK as Serviço de Mercado
  participant DB as Banco de dados
  participant ORC as Orquestrador

  Note over MK: falha controlada da demo, o contêiner é derrubado
  ORC->>MK: parar contêiner
  GW-xMK: health check sem resposta
  GW->>GW: circuit breaker abre
  GW-->>HB: aviso de mercado indisponível
  Note over HB: o cliente segue conectado e ordens novas recebem erro claro

  ORC->>MK: reiniciar contêiner
  MK->>DB: carrega estado persistido (preços, fase do ciclo, eventos, falência)
  DB-->>MK: estado
  MK->>MK: retoma os ticks sem repetir a falência
  GW->>MK: health check
  MK-->>GW: saudável
  GW->>GW: circuit breaker fecha
  GW-->>HB: mercado disponível

  Note over HB,GW: cenário alternativo, o cliente perde a conexão
  HB->>GW: reconecta com token e último número de sequência recebido
  GW->>GW: valida a sessão e reconhece o investidor
  GW->>MK: pede snapshot e eventos após o último número de sequência
  MK-->>GW: snapshot e eventos perdidos
  GW-->>HB: carteira, livro, preços e eventos atualizados
```

## 8. Estados da ordem

Ciclo de vida de uma ordem, incluindo o cancelamento por falência do ativo.

```mermaid
stateDiagram-v2
  [*] --> RECEBIDA
  RECEBIDA --> REJEITADA : validação falha ou fundos insuficientes
  RECEBIDA --> ABERTA : reserva concedida e inserida no livro
  ABERTA --> PARCIALMENTE_EXECUTADA : negociação parcial
  ABERTA --> EXECUTADA : negociação total
  PARCIALMENTE_EXECUTADA --> PARCIALMENTE_EXECUTADA : nova negociação parcial
  PARCIALMENTE_EXECUTADA --> EXECUTADA : completa a quantidade
  ABERTA --> CANCELADA : cancelada pelo dono ou pela falência do ativo
  PARCIALMENTE_EXECUTADA --> CANCELADA : saldo restante cancelado
  REJEITADA --> [*]
  EXECUTADA --> [*]
  CANCELADA --> [*]
```

## 9. Estados do ativo

Falência terminal: depois de `FALIDO` o ativo não reabre até o administrador reiniciar o mercado **(A)**.

```mermaid
stateDiagram-v2
  [*] --> ATIVO
  state ATIVO {
    [*] --> NORMAL
    NORMAL --> EM_EVENTO : evento anunciado e aplicado
    EM_EVENTO --> NORMAL : evento expira
  }
  ATIVO --> FALIDO : falência agendada dispara
  FALIDO --> [*]
  note right of FALIDO : GAME OVER exibido no label, sem reabertura
```

## 10. Modelo de dados (ER)

Persistência exigida na seção 7.6: usuários, saldo, carteira, ativos, ordens, negociações e histórico de operações. Tipos genéricos, sem amarrar a tecnologia de banco.

```mermaid
erDiagram
  INVESTIDOR ||--o{ SESSAO : possui
  INVESTIDOR ||--o{ ORDEM : envia
  INVESTIDOR ||--o{ POSICAO : "detém"
  ATIVO ||--o{ POSICAO : "é detido em"
  ATIVO ||--o{ ORDEM : "é negociado em"
  ATIVO ||--o{ NEGOCIACAO : registra
  ATIVO ||--o{ EVENTO_MERCADO : "é alvo de"
  ATIVO ||--o| AGENDAMENTO_FALENCIA : "pode ter"
  ORDEM ||--o{ NEGOCIACAO : "como compra"
  ORDEM ||--o{ NEGOCIACAO : "como venda"
  ORDEM ||--o{ REGISTRO_OPERACAO : gera

  INVESTIDOR {
    uuid id PK
    string nome
    string email UK
    string senha_hash
    decimal saldo_disponivel
    decimal saldo_reservado
    boolean eh_npc
  }
  SESSAO {
    string token PK
    uuid investidor_id FK
    datetime criada_em
    datetime expira_em
    datetime ultimo_heartbeat
    boolean ativa
  }
  ATIVO {
    string ticker PK
    string nome
    string categoria
    string perfil_preco
    decimal piso
    decimal teto
    decimal preco_referencia
    decimal ultimo_preco
    string status
    boolean pode_falir
    string mensagem_game_over
  }
  ORDEM {
    uuid id PK
    uuid investidor_id FK
    string ticker FK
    string lado
    decimal preco_limite
    int quantidade
    int quantidade_executada
    string status
    datetime criada_em
    bigint sequencia
  }
  NEGOCIACAO {
    uuid id PK
    string ticker FK
    uuid ordem_compra_id FK
    uuid ordem_venda_id FK
    int quantidade
    decimal preco
    datetime executada_em
    bigint sequencia
  }
  POSICAO {
    uuid investidor_id PK
    string ticker PK
    int quantidade
    int quantidade_reservada
    decimal preco_medio
  }
  EVENTO_MERCADO {
    uuid id PK
    string tipo
    string ticker FK
    datetime anunciado_em
    datetime inicio
    datetime fim
  }
  AGENDAMENTO_FALENCIA {
    string ticker PK
    datetime agendada_para
    datetime executada_em
    bigint seed
  }
  REGISTRO_OPERACAO {
    uuid id PK
    uuid ordem_id FK
    string etapa
    datetime momento
    string detalhe
  }
```