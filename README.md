# Voyage Vibes - Flight booking app

## Infrastructure

| Component | Database | http Port | https Port |
|-----------|----------|-----------|------------|
| Keycloak  | Postgres | 8090      | 8091       |

**Images used**
- [Keycloak]()  
registry.redhat.io/rhbk/keycloak-rhel9:26.2-15

## Databases

| Component | Port     | Port outside container |
|-----------|----------|------------------------|
| Postgres  | 5432     | 5433                   |

**Images used for DB**  
- Postgres  
registry.redhat.io/rhel9/postgresql-16:latest

## Services

| Service                                     | DB port     | DB port outside container   | http port | https port |
|---------------------------------------------|-------------|-----------------------------|-----------|------------|
| [Auth service](./01-authservice/README.md)  | 5432        | 5433                        | 8081      | 7071       |

**Images used for services**

- Auth service  
registry.redhat.io/ubi9/openjdk-17@sha256:615a2e789a3b2d982ec9e126d525697032440b1eace5dfea4fe6618cc85a7935


podman compose -f docker-compose.yml up -d
