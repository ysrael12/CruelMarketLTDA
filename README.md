# Integrantes
- Diogo Lima de Oliveira
- Hugo Santos da Paixão
- Kevin Teixeira de Araújo Carvalho
- Pedro Henrique Macedo Antunes
- Ysrael de Jesus Sacramento


# CruelMarketLTDA
# CruelMarketLTDA
Projeto da matéria de sistemas distribuídos UFS, Cruel Market LTDA é uma holding financeira, que visa lucros e crueldade.


# Fases de Entrega 
## Parte 1 
- Definição das regras de negócios [Fonte][];
- Descrição dos ativos e investidores; 
- Arquitetura Proposta; 
- Diagrama dos componentes [ComoFazer][]; 
- Stack escolhida; 
- Protocolos de comunicação; 
- Bancos de dados;
- Estratégia de consistencia; 
- Estratégias de tolerância a falhas; 
- Proposta dos agentes; 
- Cronograma de desenvolvimento;

[Fonte]: https://crueltysquad.fandom.com/wiki/Cruelty_Squad_Wiki 

[ComoFazer]: https://lucid.co/pt/diagrama/uml/tutorial-de-diagrama-de-componentes 

### P1 prototipo 
- Conexão de múltiplos clientes; 
- Auth; 
- Entrada de mercado; 
- view dos ativos; 
- envio de ordens; 
- comunicação cliente/servidor; 
- atualização básica do home broker;

### Funcionalidades
- Gateway : o load balancer, responsável por reconectar também 
- Market Data : informações sobre o mercado, quantidade de ativos e preços
- Matching Engine : Recebe as ordens e tenta casar compras e vendas. Apenas processa os dados e repassa o resultado ao Order Service.
- Order Service : informação sobre matching engine, além de manter o histórico de ordens e negociações
- Server : verifica se o usuário mandou um método válido e faz o push websocket
- Session : validação de identidade
- User Data : saldo e quantos ativos o usuário tem
