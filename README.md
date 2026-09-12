# Recarga Fácil

### Plataforma para localização e utilização de pontos de recarga para veículos elétricos

Projeto acadêmico desenvolvido durante o curso de Análise e Desenvolvimento de Sistemas, com o objetivo de criar uma solução para facilitar o acesso a pontos de recarga para veículos elétricos, conectando usuários a pontos de carregamento disponíveis.

---

## Sobre o Projeto

O Recarga Fácil é uma plataforma voltada para a localização e utilização de pontos de recarga para veículos elétricos.

A proposta do projeto é contribuir para a expansão da mobilidade elétrica, facilitando a busca por pontos de recarga e permitindo a organização das informações dos carregadores.

O projeto foi desenvolvido utilizando uma arquitetura com Backend e Banco de Dados, com o backend responsável pelo gerenciamento da aplicação e comunicação com o banco.

---

## Tecnologias Utilizadas

### Backend
- Java 17
- Spring Boot
- Spring Web
- Spring Data JPA
- Maven
- API REST
- Swagger / OpenAPI

### Banco de Dados
- MySQL 8.0
- PostgreSQL 16
- H2 Database (perfil de desenvolvimento rápido, sem dependências externas)

### Infraestrutura
- Docker
- Docker Compose
- Deploy em produção via Render (PostgreSQL gerenciado)

### Ferramentas
- Git
- GitHub
- IntelliJ IDEA

---

## Como Executar o Projeto Localmente

O projeto suporta três perfis de banco de dados, escolhidos via `spring.profiles.active`.

### Opção 1 — H2 (mais rápido, sem dependências)
Não requer Docker. Basta rodar a aplicação com o perfil `h2` ativo.

### Opção 2 — MySQL ou PostgreSQL (via Docker)

1. Copie o arquivo `.env.example` para `.env` e preencha com as credenciais locais.
2. Suba o banco desejado:
   ```
   docker compose up -d mysql
   # ou
   docker compose up -d postgres
   ```
3. Ative o perfil correspondente (`mysql` ou `postgres`) e rode a aplicação.

O arquivo `.env` **não é versionado** — cada colaborador cria o seu próprio localmente a partir do `.env.example`.

### Documentação da API

Com a aplicação em execução, a documentação Swagger fica disponível em:
```
http://localhost:8080/swagger-ui.html
```

---

## Estrutura do Projeto

```
recarga_facil/
│
├── src/
│   └── main/
│       ├── java/
│       │   └── com/recargafacil/
│       │       ├── controller/
│       │       ├── dto/
│       │       ├── model/
│       │       └── repository/
│       │
│       └── resources/
│           ├── application.properties
│           ├── application-h2.properties
│           ├── application-mysql.properties
│           └── application-postgres.properties
│
├── docker-compose.yml
├── Dockerfile
├── .env.example
├── insert_data.sql
├── pom.xml
└── README.md
```

---

## Projeto Acadêmico

Este projeto foi desenvolvido como parte das atividades acadêmicas do curso de **Tecnólogo em Análise e Desenvolvimento de Sistemas**, envolvendo conceitos de desenvolvimento web, programação orientada a objetos, desenvolvimento de APIs, banco de dados e infraestrutura.
