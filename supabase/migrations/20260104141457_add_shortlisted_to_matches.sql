alter table matches
add column if not exists shortlisted boolean default false;
