create table if not exists customer_profiles (
    keycloak_user_id varchar(64) primary key,
    email varchar(255) not null,
    full_name varchar(255),
    given_name varchar(255),
    family_name varchar(255),
    identity_provider varchar(100),
    email_verified boolean not null default false,
    created_at timestamp not null,
    updated_at timestamp not null
);

create index if not exists idx_customer_profiles_email on customer_profiles (email);
