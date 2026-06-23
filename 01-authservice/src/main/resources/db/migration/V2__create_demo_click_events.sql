create table if not exists demo_click_events (
    id uuid primary key,
    session_id varchar(80) not null,
    button_name varchar(120) not null,
    trace_id varchar(64),
    span_id varchar(32),
    user_agent varchar(512),
    created_at timestamp not null
);

create index if not exists idx_demo_click_events_created_at on demo_click_events (created_at);
create index if not exists idx_demo_click_events_trace_id on demo_click_events (trace_id);
